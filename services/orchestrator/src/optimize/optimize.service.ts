import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../common/prisma.service';
import { MongoService } from '../common/mongo.service';
import { S3Service } from '../common/s3.service';

const OPTIMIZER_URL = process.env.OPTIMIZER_URL || 'http://ai-optimizer:8004';
const ATS_URL = process.env.ATS_ENGINE_URL || 'http://ats-engine:8003';
const BUCKET = process.env.S3_BUCKET_RESUMES || 'resumes-raw';

@Injectable()
export class OptimizeService {
  constructor(
    private prisma: PrismaService,
    private mongo: MongoService,
    private s3: S3Service,
  ) {}

  async run(userId: string, resumeVersionId: string, jdId: string) {
    const version = await this.prisma.resumeVersion.findUnique({
      where: { id: resumeVersionId },
      include: { resume: true },
    });
    if (!version || version.resume.userId !== userId) throw new NotFoundException('Resume version not found');

    const jd = await this.prisma.jobDescription.findUnique({ where: { id: jdId } });
    if (!jd) throw new NotFoundException('JD not found');

    // Load parsed resume + most recent score (for the planner).
    const resumeDoc = await this.mongo.db().collection('resume_documents').findOne({
      _id: this.objectId(version.mongoDocId),
    });
    if (!resumeDoc) throw new BadRequestException('Parsed resume missing');

    const lastScore = await this.prisma.atsScore.findFirst({
      where: { resumeVersionId, jdId },
      orderBy: { createdAt: 'desc' },
    });

    // Call the optimizer.
    let opt: any;
    try {
      const r = await axios.post(
        `${OPTIMIZER_URL}/optimize`,
        {
          resume: resumeDoc.parsed,
          jd: jd.parsedJson,
          score: lastScore
            ? {
                matched_skills: lastScore.matchedSkills,
                missing_skills: lastScore.missingSkills,
                section_scores: lastScore.sectionScores,
                overall: lastScore.overall,
              }
            : {},
          original_latex: resumeDoc.parsed?.latex_source ?? null,
        },
        { timeout: 120_000 },
      );
      opt = r.data;
    } catch (e: any) {
      throw new BadRequestException(`Optimizer failed: ${e?.response?.data?.detail || e.message}`);
    }

    // Persist optimized PDF to MinIO.
    let s3PdfKey: string | null = null;
    if (opt.pdf_b64) {
      const buf = Buffer.from(opt.pdf_b64, 'base64');
      s3PdfKey = await this.s3.putObject(BUCKET, buf, 'application/pdf', 'pdf');
    }
    let s3LatexKey: string | null = null;
    if (opt.new_latex) {
      const buf = Buffer.from(opt.new_latex, 'utf-8');
      s3LatexKey = await this.s3.putObject(BUCKET, buf, 'application/x-tex', 'tex');
    }

    // Save a new ResumeVersion (child of the original) with the optimized doc.
    const docResult = await this.mongo.db().collection('resume_documents').insertOne({
      userId,
      sourceType: version.resume.sourceType,
      parsed: opt.new_resume,
      ai_optimized: true,
      proposals: opt.proposals,
      applied: opt.applied,
      rejected: opt.rejected,
      duration_ms: opt.duration_ms,
      createdAt: new Date(),
    });
    const newMongoDocId = docResult.insertedId.toString();

    const newVersion = await this.prisma.resumeVersion.create({
      data: {
        resumeId: version.resumeId,
        parentVersionId: version.id,
        label: `optimized-for-${jd.id.slice(0, 8)}`,
        mongoDocId: newMongoDocId,
        s3PdfKey,
        s3LatexKey,
        createdBy: 'ai',
      },
    });

    // Persist a prompt trace for replay.
    await this.mongo.db().collection('prompt_traces').insertOne({
      userId,
      resumeVersionId: newVersion.id,
      jdId,
      plan: opt.plan,
      proposals: opt.proposals,
      applied: opt.applied,
      rejected: opt.rejected,
      createdAt: new Date(),
    });

    // Re-score against the same JD using the new resume.
    let newScore: any = null;
    try {
      const r = await axios.post(
        `${ATS_URL}/score`,
        { resume: opt.new_resume, jd: jd.parsedJson },
        { timeout: 120_000 },
      );
      newScore = r.data;
      await this.prisma.atsScore.create({
        data: {
          resumeVersionId: newVersion.id,
          jdId,
          overall: newScore.overall,
          sectionScores: newScore.section_scores,
          matchedSkills: newScore.matched_skills,
          missingSkills: newScore.missing_skills,
          missingKeywords: newScore.missing_keywords,
          recruiterFit: newScore.recruiter_fit,
          rationale: newScore.rationale,
        },
      });
    } catch (e: any) {
      // Re-score is best-effort; surface the original optimization result anyway.
      newScore = { error: e?.message || 'rescore failed' };
    }

    return {
      newVersionId: newVersion.id,
      jdId,
      originalVersionId: version.id,
      original: {
        parsed: resumeDoc.parsed,
        score: lastScore,
      },
      optimized: {
        parsed: opt.new_resume,
        proposals: opt.proposals,
        applied: opt.applied,
        rejected: opt.rejected,
        new_latex_available: Boolean(s3LatexKey),
        pdf_available: Boolean(s3PdfKey),
      },
      score: newScore,
      improvement: lastScore && newScore && !newScore.error
        ? Number((newScore.overall - lastScore.overall).toFixed(2))
        : null,
    };
  }

  async get(userId: string, newVersionId: string) {
    const v = await this.prisma.resumeVersion.findUnique({
      where: { id: newVersionId },
      include: { resume: true, scores: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!v || v.resume.userId !== userId) throw new NotFoundException();
    const doc = await this.mongo.db().collection('resume_documents').findOne({
      _id: this.objectId(v.mongoDocId),
    });
    return {
      versionId: v.id,
      label: v.label,
      parentVersionId: v.parentVersionId,
      createdBy: v.createdBy,
      s3PdfKey: v.s3PdfKey,
      s3LatexKey: v.s3LatexKey,
      parsed: doc?.parsed,
      proposals: doc?.proposals,
      applied: doc?.applied,
      rejected: doc?.rejected,
      score: v.scores[0] || null,
    };
  }

  async downloadLatex(userId: string, versionId: string): Promise<{ filename: string; body: Buffer }> {
    const v = await this.prisma.resumeVersion.findUnique({
      where: { id: versionId },
      include: { resume: true },
    });
    if (!v || v.resume.userId !== userId) throw new NotFoundException();
    if (!v.s3LatexKey) throw new BadRequestException('No LaTeX available for this version.');
    const body = await this.s3.getObject(BUCKET, v.s3LatexKey);
    return { filename: `resume-${v.id.slice(0, 8)}.tex`, body };
  }

  async downloadPdf(userId: string, versionId: string): Promise<{ filename: string; body: Buffer }> {
    const v = await this.prisma.resumeVersion.findUnique({
      where: { id: versionId },
      include: { resume: true },
    });
    if (!v || v.resume.userId !== userId) throw new NotFoundException();
    if (!v.s3PdfKey) throw new BadRequestException('No PDF available for this version.');
    const body = await this.s3.getObject(BUCKET, v.s3PdfKey);
    return { filename: `resume-${v.id.slice(0, 8)}.pdf`, body };
  }

  async promote(userId: string, versionId: string) {
    const v = await this.prisma.resumeVersion.findUnique({
      where: { id: versionId },
      include: { resume: true },
    });
    if (!v || v.resume.userId !== userId) throw new NotFoundException();
    await this.prisma.resume.update({
      where: { id: v.resumeId },
      data: { currentVersionId: v.id },
    });
    return { ok: true, resumeId: v.resumeId, currentVersionId: v.id };
  }

  private objectId(id: string) {
    const { ObjectId } = require('mongodb');
    return new ObjectId(id);
  }
}
