import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { normalizeLabel } from './normalize';

/**
 * Confidence scoring:
 *   1.0  - exact label match in field_mappings
 *   0.9  - synonym match (default for seeded entries)
 *   0.6  - substring fallback (e.g. label includes a known mapping label)
 *   0.0  - unmatched
 */
export interface Resolution {
  profileField: string | null;     // dot-path, or "saved_answer", or null
  value: any | null;               // pre-resolved value if available
  confidence: number;
  source: 'field_mapping' | 'saved_answer' | 'profile' | 'unmatched';
}

@Injectable()
export class SmartApplyService {
  constructor(private prisma: PrismaService) {}

  /** Snapshot of everything the auto-apply driver needs for one application. */
  async applyContext(userId: string) {
    const [user, profile, savedAnswers, mappings, primaryResume] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, fullName: true },
      }),
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.savedAnswer.findMany({ where: { userId } }),
      this.prisma.fieldMapping.findMany({}),
      this.prisma.profile
        .findUnique({ where: { userId } })
        .then(async (p) => (p?.primaryResumeId ? this.prisma.resume.findUnique({ where: { id: p.primaryResumeId } }) : null)),
    ]);
    if (!user) throw new NotFoundException();
    // Flatten profile + user into a single addressable scope the worker can read by path.
    const scope = this.buildScope(user, profile);
    return {
      scope,
      savedAnswers: savedAnswers.map((a) => ({
        questionKey: a.questionKey,
        questionText: a.questionText,
        answerText: a.answerText,
      })),
      mappings: mappings.map((m) => ({
        labelPattern: m.labelPattern,
        profileField: m.profileField,
        confidence: m.confidence,
      })),
      primaryResume: primaryResume
        ? { id: primaryResume.id, sourceType: primaryResume.sourceType, s3Key: primaryResume.s3Key }
        : null,
    };
  }

  /** Resolve one form-field label against the user's mappings + saved answers + profile. */
  async resolveLabel(userId: string, label: string): Promise<Resolution> {
    const norm = normalizeLabel(label);
    if (!norm) return { profileField: null, value: null, confidence: 0, source: 'unmatched' };

    // 1) Exact saved answer hit.
    const saved = await this.prisma.savedAnswer.findUnique({
      where: { userId_questionKey: { userId, questionKey: norm } },
    });
    if (saved) {
      return { profileField: 'saved_answer', value: saved.answerText, confidence: 1.0, source: 'saved_answer' };
    }

    // 2) Mapping table hit (exact then substring).
    const exact = await this.prisma.fieldMapping.findUnique({ where: { labelPattern: norm } });
    let match = exact;
    let confidence = exact?.confidence ?? 0;
    if (!match) {
      // Substring fallback: find any mapping whose pattern is contained in this label.
      const all = await this.prisma.fieldMapping.findMany({});
      const sub = all.find((m) => norm.includes(m.labelPattern) || m.labelPattern.includes(norm));
      if (sub) { match = sub; confidence = Math.min(0.6, sub.confidence); }
    }
    if (match) {
      const value = await this.readByPath(userId, match.profileField);
      return {
        profileField: match.profileField,
        value,
        confidence,
        source: value != null ? 'profile' : 'field_mapping',
      };
    }
    return { profileField: null, value: null, confidence: 0, source: 'unmatched' };
  }

  // ----- saved_answers CRUD ---------------------------------------------

  listAnswers(userId: string) {
    return this.prisma.savedAnswer.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async upsertAnswer(userId: string, questionText: string, answerText: string, source = 'user') {
    const questionKey = normalizeLabel(questionText);
    if (!questionKey) throw new NotFoundException('Empty question');
    return this.prisma.savedAnswer.upsert({
      where: { userId_questionKey: { userId, questionKey } },
      update: { answerText, questionText, source },
      create: { userId, questionKey, questionText, answerText, source },
    });
  }

  deleteAnswer(userId: string, questionKey: string) {
    return this.prisma.savedAnswer.delete({
      where: { userId_questionKey: { userId, questionKey: normalizeLabel(questionKey) } },
    });
  }

  // ----- application_questionnaires ----------------------------------------

  upsertQuestionnaire(applicationId: string, payload: any) {
    return this.prisma.applicationQuestionnaire.upsert({
      where: { applicationId },
      update: { payload },
      create: { applicationId, payload },
    });
  }

  getQuestionnaire(applicationId: string) {
    return this.prisma.applicationQuestionnaire.findUnique({ where: { applicationId } });
  }

  /**
   * Answer a list of pending questions for an application: each one becomes
   * a saved_answer (reused on future apps) and the questionnaire payload's
   * `pending` array is shrunk accordingly.
   */
  async answerPending(
    userId: string,
    applicationId: string,
    answers: Array<{ questionText: string; answerText: string }>,
  ) {
    for (const a of answers) {
      if (!a.questionText || !a.answerText) continue;
      await this.upsertAnswer(userId, a.questionText, a.answerText, 'application');
    }
    const q = await this.prisma.applicationQuestionnaire.findUnique({ where: { applicationId } });
    if (q && Array.isArray((q.payload as any)?.pending)) {
      const answeredKeys = new Set(answers.map((a) => normalizeLabel(a.questionText)));
      const newPending = ((q.payload as any).pending as any[]).filter(
        (p) => !answeredKeys.has(normalizeLabel(p.label)),
      );
      await this.prisma.applicationQuestionnaire.update({
        where: { applicationId },
        data: { payload: { ...(q.payload as any), pending: newPending } },
      });
    }
    return { ok: true };
  }

  // ----- helpers --------------------------------------------------------

  private buildScope(user: any, profile: any) {
    const split = (name?: string | null) => {
      const parts = (name || '').trim().split(/\s+/);
      return { first: parts[0] || null, last: parts.length > 1 ? parts.slice(1).join(' ') : null };
    };
    const { first, last } = split(profile?.fullName || user.fullName);
    return {
      user: { email: user.email },
      profile: {
        full_name: profile?.fullName ?? user.fullName ?? null,
        first_name: first,
        last_name: last,
        phone: profile?.phone ?? null,
        current_location: profile?.currentLocation ?? null,
        linkedin_url: profile?.linkedinUrl ?? null,
        github_url: profile?.githubUrl ?? null,
        portfolio_url: profile?.portfolioUrl ?? null,
        job_title: profile?.jobTitle ?? null,
        linkedin_headline: profile?.linkedinHeadline ?? null,
        years_of_experience: profile?.yearsOfExperience ?? null,
        current_company: profile?.currentCompany ?? null,
        notice_period: profile?.noticePeriod ?? null,
        current_salary: profile?.currentSalary ?? null,
        expected_salary: profile?.expectedSalary ?? null,
        work_auth: profile?.workAuth ?? null,
        requires_sponsorship: profile?.requiresSponsorship ?? null,
        preferred_location: profile?.preferredLocation ?? null,
        gender: profile?.gender ?? null,
        race: profile?.race ?? null,
        veteran_status: profile?.veteranStatus ?? null,
        disability_status: profile?.disabilityStatus ?? null,
      },
    };
  }

  /** Read a dot-path value from the user's scope. */
  private async readByPath(userId: string, path: string): Promise<any> {
    if (path === 'saved_answer' || path === 'profile.resume') return null;
    const [user, profile] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, fullName: true } }),
      this.prisma.profile.findUnique({ where: { userId } }),
    ]);
    const scope = this.buildScope(user, profile) as any;
    const parts = path.split('.');
    let cur: any = scope;
    for (const p of parts) {
      if (cur == null) return null;
      cur = cur[p];
    }
    return cur ?? null;
  }
}
