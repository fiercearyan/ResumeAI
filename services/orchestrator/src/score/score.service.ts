import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../common/prisma.service';
import { MongoService } from '../common/mongo.service';
import { ScoreGateway } from './score.gateway';
import { notify } from '../common/notify';

const ATS_URL = process.env.ATS_ENGINE_URL || 'http://ats-engine:8003';

@Injectable()
export class ScoreService {
  constructor(
    private prisma: PrismaService,
    private mongo: MongoService,
    private gateway: ScoreGateway,
  ) {}

  async runScore(userId: string, resumeVersionId: string, jdId: string) {
    const version = await this.prisma.resumeVersion.findUnique({
      where: { id: resumeVersionId },
      include: { resume: true },
    });
    if (!version || version.resume.userId !== userId) {
      throw new NotFoundException('Resume version not found');
    }
    const jd = await this.prisma.jobDescription.findUnique({ where: { id: jdId } });
    if (!jd) throw new NotFoundException('JD not found');

    const resumeDoc = await this.mongo.db().collection('resume_documents').findOne({
      _id: this.objectId(version.mongoDocId),
    });
    if (!resumeDoc) throw new BadRequestException('Parsed resume missing');

    const taskRoom = `score:${resumeVersionId}:${jdId}`;
    this.gateway.emit(taskRoom, { stage: 'started', progress: 0 });

    let scoreResp: any;
    try {
      this.gateway.emit(taskRoom, { stage: 'scoring', progress: 30 });
      const r = await axios.post(
        `${ATS_URL}/score`,
        { resume: resumeDoc.parsed, jd: jd.parsedJson },
        { timeout: 90000 },
      );
      scoreResp = r.data;
    } catch (e: any) {
      this.gateway.emit(taskRoom, { stage: 'error', error: e?.response?.data?.detail || e.message });
      throw new BadRequestException(`ATS engine failed: ${e?.response?.data?.detail || e.message}`);
    }

    this.gateway.emit(taskRoom, { stage: 'persisting', progress: 90 });

    const saved = await this.prisma.atsScore.create({
      data: {
        resumeVersionId,
        jdId,
        overall: scoreResp.overall,
        sectionScores: scoreResp.section_scores,
        matchedSkills: scoreResp.matched_skills,
        missingSkills: scoreResp.missing_skills,
        missingKeywords: scoreResp.missing_keywords,
        recruiterFit: scoreResp.recruiter_fit,
        rationale: scoreResp.rationale,
      },
    });

    this.gateway.emit(taskRoom, { stage: 'completed', progress: 100, scoreId: saved.id });

    // Fire-and-forget email — best-effort, never blocks the response.
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user) {
      notify({
        userId,
        email: user.email,
        template: 'score_complete',
        data: { overall: scoreResp.overall, jdTitle: jd.title, scoreId: saved.id },
        idempotencyKey: `score:${saved.id}`,
      });
    }
    return saved;
  }

  async get(userId: string, id: string) {
    const score = await this.prisma.atsScore.findUnique({
      where: { id },
      include: {
        resumeVersion: { include: { resume: true } },
        jd: true,
      },
    });
    if (!score || score.resumeVersion.resume.userId !== userId) throw new NotFoundException();
    return score;
  }

  async listForResume(userId: string, resumeId: string) {
    return this.prisma.atsScore.findMany({
      where: { resumeVersion: { resumeId, resume: { userId } } },
      orderBy: { createdAt: 'desc' },
      include: { jd: true },
    });
  }

  private objectId(id: string) {
    const { ObjectId } = require('mongodb');
    return new ObjectId(id);
  }
}
