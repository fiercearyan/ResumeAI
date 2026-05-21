import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { MongoService } from '../common/mongo.service';
import { notify } from '../common/notify';

/**
 * GDPR endpoints — user-facing export + hard-delete.
 *
 * Export gathers everything we know about the user (Postgres rows +
 * Mongo parsed documents) into a single JSON blob the user can download.
 *
 * Delete cascades through every owned resource (Postgres ON DELETE CASCADE
 * handles most of it; we also purge Mongo docs that don't have a foreign
 * key). The user row itself is removed — no soft-delete tombstone — so
 * users can re-register with the same email.
 */
@Injectable()
export class MeService {
  constructor(private prisma: PrismaService, private mongo: MongoService) {}

  async export(userId: string) {
    const [
      user,
      profile,
      experiences,
      education,
      projects,
      skills,
      certifications,
      resumes,
      jds,
      scores,
      applications,
      events,
      preferences,
    ] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.profileExperience.findMany({ where: { userId } }),
      this.prisma.profileEducation.findMany({ where: { userId } }),
      this.prisma.profileProject.findMany({ where: { userId } }),
      this.prisma.profileSkill.findMany({ where: { userId } }),
      this.prisma.profileCertification.findMany({ where: { userId } }),
      this.prisma.resume.findMany({ where: { userId }, include: { versions: true } }),
      this.prisma.jobDescription.findMany({ where: { userId } }),
      this.prisma.atsScore.findMany({
        where: { resumeVersion: { resume: { userId } } },
      }),
      this.prisma.application.findMany({ where: { userId } }),
      this.prisma.applyEvent.findMany({
        where: { application: { userId } } as any,
      }).catch(() => []),
      this.prisma.userPreference.findUnique({ where: { userId } }),
    ]);

    // Parsed resume docs from Mongo.
    const mongoDocIds = resumes.flatMap((r) => r.versions.map((v) => v.mongoDocId));
    let resumeDocs: any[] = [];
    if (mongoDocIds.length) {
      const { ObjectId } = require('mongodb');
      const objectIds = mongoDocIds.map((id) => new ObjectId(id));
      resumeDocs = await this.mongo
        .db()
        .collection('resume_documents')
        .find({ _id: { $in: objectIds } })
        .toArray();
    }

    return {
      exportedAt: new Date().toISOString(),
      user: this.scrub(user),
      profile,
      experiences,
      education,
      projects,
      skills,
      certifications,
      preferences,
      resumes,
      resumeDocs,
      jobDescriptions: jds,
      atsScores: scores,
      applications,
      applyEvents: events,
    };
  }

  async hardDelete(userId: string) {
    // Capture email BEFORE deletion so we can send the confirmation.
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });

    // Mongo first — no FK, no ON DELETE.
    const resumes = await this.prisma.resume.findMany({
      where: { userId },
      include: { versions: true },
    });
    const mongoDocIds = resumes.flatMap((r) => r.versions.map((v) => v.mongoDocId));
    if (mongoDocIds.length) {
      const { ObjectId } = require('mongodb');
      const objectIds = mongoDocIds.map((id) => new ObjectId(id));
      await this.mongo
        .db()
        .collection('resume_documents')
        .deleteMany({ _id: { $in: objectIds } });
      await this.mongo.db().collection('prompt_traces').deleteMany({ userId });
    }
    // Postgres: cascade from users (every owned table has ON DELETE CASCADE).
    await this.prisma.user.delete({ where: { id: userId } });
    if (user) {
      notify({
        email: user.email,
        template: 'account_deleted',
        idempotencyKey: `account_deleted:${userId}`,
      });
    }
    return { ok: true };
  }

  private scrub(u: any) {
    if (!u) return u;
    const { passwordHash, mfaSecretEnc, mfaBackupCodesHash, ...rest } = u;
    return rest;
  }
}
