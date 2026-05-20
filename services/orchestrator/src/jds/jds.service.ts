import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma.service';

const JD_PARSER = process.env.JD_PARSER_URL || 'http://jd-parser:8002';

@Injectable()
export class JdsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, body: { type: 'url' | 'text'; payload: string }) {
    if (!body?.type || !body?.payload) throw new BadRequestException('type and payload required');
    const contentHash = createHash('sha256').update(`${body.type}:${body.payload}`).digest('hex');

    const existing = await this.prisma.jobDescription.findUnique({ where: { contentHash } });
    if (existing) {
      // Re-link to this user if no owner yet.
      if (!existing.userId) {
        await this.prisma.jobDescription.update({ where: { id: existing.id }, data: { userId } });
      }
      return existing;
    }

    let parsed: any;
    try {
      const res = await axios.post(
        `${JD_PARSER}/parse`,
        { type: body.type, payload: body.payload },
        { timeout: 45000 },
      );
      parsed = res.data;
    } catch (e: any) {
      throw new BadRequestException(`JD parser failed: ${e?.response?.data?.detail || e.message}`);
    }

    const jd = await this.prisma.jobDescription.create({
      data: {
        userId,
        sourceType: body.type,
        sourceUrl: body.type === 'url' ? body.payload : null,
        title: parsed.title ?? null,
        company: parsed.company ?? null,
        location: parsed.location ?? null,
        parsedJson: parsed,
        contentHash,
      },
    });
    return jd;
  }

  async list(userId: string) {
    return this.prisma.jobDescription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(userId: string, id: string) {
    const jd = await this.prisma.jobDescription.findFirst({ where: { id, userId } });
    if (!jd) throw new NotFoundException();
    return jd;
  }
}
