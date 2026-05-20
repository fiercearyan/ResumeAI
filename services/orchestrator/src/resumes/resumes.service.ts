import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import { PrismaService } from '../common/prisma.service';
import { MongoService } from '../common/mongo.service';
import { S3Service } from '../common/s3.service';

const PARSER_URL = process.env.RESUME_PARSER_URL || 'http://resume-parser:8001';
const BUCKET = process.env.S3_BUCKET_RESUMES || 'resumes-raw';

@Injectable()
export class ResumesService {
  constructor(private prisma: PrismaService, private mongo: MongoService, private s3: S3Service) {}

  async upload(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('file required');
    const sourceType = detectSourceType(file.originalname, file.mimetype);
    if (!sourceType) throw new BadRequestException('Unsupported file type. Use PDF, DOCX, or LaTeX (.tex).');

    // 1) Upload raw file to MinIO.
    const ext = sourceType === 'latex' ? 'tex' : sourceType;
    const s3Key = await this.s3.putObject(BUCKET, file.buffer, file.mimetype, ext);

    // 2) Send to Python parser.
    const form = new FormData();
    form.append('file', file.buffer, { filename: file.originalname, contentType: file.mimetype });
    form.append('source_type', sourceType);
    let parsed: any;
    try {
      const res = await axios.post(`${PARSER_URL}/parse`, form, {
        headers: form.getHeaders(),
        maxContentLength: 25 * 1024 * 1024,
        maxBodyLength: 25 * 1024 * 1024,
        timeout: 30000,
      });
      parsed = res.data;
    } catch (e: any) {
      throw new BadRequestException(`Resume parser failed: ${e?.response?.data?.detail || e.message}`);
    }

    // 3) Persist parsed doc in Mongo.
    const doc = await this.mongo.db().collection('resume_documents').insertOne({
      userId,
      sourceType,
      s3Key,
      parsed,
      createdAt: new Date(),
    });
    const mongoDocId = doc.insertedId.toString();

    // 4) Postgres rows: resume + initial version.
    const resume = await this.prisma.resume.create({
      data: { userId, sourceType, s3Key, mongoDocId },
    });
    const version = await this.prisma.resumeVersion.create({
      data: {
        resumeId: resume.id,
        mongoDocId,
        label: 'original',
        createdBy: 'user',
      },
    });
    await this.prisma.resume.update({
      where: { id: resume.id },
      data: { currentVersionId: version.id },
    });

    return {
      id: resume.id,
      versionId: version.id,
      sourceType,
      filename: file.originalname,
      parsed,
    };
  }

  async list(userId: string) {
    const items = await this.prisma.resume.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { versions: { orderBy: { createdAt: 'desc' } } },
    });
    return items.map((r) => ({
      id: r.id,
      sourceType: r.sourceType,
      createdAt: r.createdAt,
      currentVersionId: r.currentVersionId,
      versions: r.versions.map((v) => ({ id: v.id, label: v.label, createdAt: v.createdAt })),
    }));
  }

  async get(userId: string, id: string) {
    const resume = await this.prisma.resume.findFirst({
      where: { id, userId },
      include: { versions: true },
    });
    if (!resume) throw new NotFoundException();
    const parsed = await this.mongo.db().collection('resume_documents').findOne({
      _id: this.mongoObjectId(resume.mongoDocId),
    });
    return {
      id: resume.id,
      sourceType: resume.sourceType,
      currentVersionId: resume.currentVersionId,
      versions: resume.versions,
      parsed: parsed?.parsed ?? null,
    };
  }

  private mongoObjectId(id: string) {
    const { ObjectId } = require('mongodb');
    return new ObjectId(id);
  }
}

function detectSourceType(name: string, mime: string): 'pdf' | 'docx' | 'latex' | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  if (lower.endsWith('.docx') || mime.includes('officedocument.wordprocessingml')) return 'docx';
  if (lower.endsWith('.tex') || mime === 'application/x-tex' || mime === 'text/x-tex') return 'latex';
  return null;
}
