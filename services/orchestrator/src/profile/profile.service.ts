import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ResumesService } from '../resumes/resumes.service';
import { computeCompletion } from './completion';
import type {
  PatchProfileDto,
  ExperienceDto,
  EducationDto,
  ProjectDto,
  SkillsBulkDto,
  CertificationDto,
} from './dto';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService, private resumes: ResumesService) {}

  /** Lazy upsert — returns a row even if the user never opened the profile page. */
  private async ensureProfile(userId: string) {
    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    if (existing) return existing;
    // Seed from User.fullName so a brand-new account already shows a name.
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    return this.prisma.profile.create({
      data: { userId, fullName: u?.fullName ?? null },
    });
  }

  async get(userId: string) {
    await this.ensureProfile(userId);
    const [profile, experiences, education, projects, skills, certifications, primaryResume] =
      await Promise.all([
        this.prisma.profile.findUnique({ where: { userId } }),
        this.prisma.profileExperience.findMany({ where: { userId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
        this.prisma.profileEducation.findMany({ where: { userId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
        this.prisma.profileProject.findMany({ where: { userId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
        this.prisma.profileSkill.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
        this.prisma.profileCertification.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
        this.prisma.profile.findUnique({ where: { userId } }).then(async (p) => {
          if (!p?.primaryResumeId) return null;
          const r = await this.prisma.resume.findUnique({ where: { id: p.primaryResumeId } });
          return r ? { id: r.id, sourceType: r.sourceType, s3Key: r.s3Key, createdAt: r.createdAt } : null;
        }),
      ]);
    return { profile, experiences, education, projects, skills, certifications, primaryResume };
  }

  async patch(userId: string, body: PatchProfileDto) {
    await this.ensureProfile(userId);
    const data: any = { ...body };
    // Mirror full_name back to users.full_name so the auth /me endpoint sees it too.
    if (typeof body.fullName === 'string') {
      await this.prisma.user.update({ where: { id: userId }, data: { fullName: body.fullName } });
    }
    await this.prisma.profile.update({ where: { userId }, data });
    return this.recompute(userId);
  }

  async uploadResume(userId: string, file: Express.Multer.File) {
    await this.ensureProfile(userId);
    if (!file) throw new BadRequestException('file required');
    const uploaded = await this.resumes.upload(userId, file);
    await this.prisma.profile.update({ where: { userId }, data: { primaryResumeId: uploaded.id } });
    return this.recompute(userId);
  }

  async unsetResume(userId: string) {
    await this.ensureProfile(userId);
    await this.prisma.profile.update({ where: { userId }, data: { primaryResumeId: null } });
    return this.recompute(userId);
  }

  // ----- experiences -------------------------------------------------------

  async createExperience(userId: string, dto: ExperienceDto) {
    await this.ensureProfile(userId);
    const maxOrder = await this.prisma.profileExperience.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });
    const e = await this.prisma.profileExperience.create({
      data: {
        userId,
        company: dto.company,
        role: dto.role,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        responsibilities: dto.responsibilities ?? null,
        techStack: dto.techStack ?? [],
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
    await this.recompute(userId);
    return e;
  }

  async updateExperience(userId: string, id: string, dto: ExperienceDto) {
    await this.assertOwn('profileExperience', userId, id);
    const e = await this.prisma.profileExperience.update({
      where: { id },
      data: {
        company: dto.company,
        role: dto.role,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        responsibilities: dto.responsibilities ?? null,
        techStack: dto.techStack ?? [],
      },
    });
    await this.recompute(userId);
    return e;
  }

  async deleteExperience(userId: string, id: string) {
    await this.assertOwn('profileExperience', userId, id);
    await this.prisma.profileExperience.delete({ where: { id } });
    return this.recompute(userId);
  }

  // ----- education ---------------------------------------------------------

  async createEducation(userId: string, dto: EducationDto) {
    await this.ensureProfile(userId);
    const maxOrder = await this.prisma.profileEducation.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });
    const r = await this.prisma.profileEducation.create({
      data: {
        userId,
        college: dto.college,
        degree: dto.degree ?? null,
        branch: dto.branch ?? null,
        startYear: dto.startYear ?? null,
        endYear: dto.endYear ?? null,
        gpa: dto.gpa ?? null,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
    await this.recompute(userId);
    return r;
  }

  async updateEducation(userId: string, id: string, dto: EducationDto) {
    await this.assertOwn('profileEducation', userId, id);
    const r = await this.prisma.profileEducation.update({
      where: { id },
      data: {
        college: dto.college,
        degree: dto.degree ?? null,
        branch: dto.branch ?? null,
        startYear: dto.startYear ?? null,
        endYear: dto.endYear ?? null,
        gpa: dto.gpa ?? null,
      },
    });
    await this.recompute(userId);
    return r;
  }

  async deleteEducation(userId: string, id: string) {
    await this.assertOwn('profileEducation', userId, id);
    await this.prisma.profileEducation.delete({ where: { id } });
    return this.recompute(userId);
  }

  // ----- projects ----------------------------------------------------------

  async createProject(userId: string, dto: ProjectDto) {
    await this.ensureProfile(userId);
    const maxOrder = await this.prisma.profileProject.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });
    const r = await this.prisma.profileProject.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description ?? null,
        techStack: dto.techStack ?? [],
        githubUrl: dto.githubUrl ?? null,
        liveUrl: dto.liveUrl ?? null,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
    await this.recompute(userId);
    return r;
  }

  async updateProject(userId: string, id: string, dto: ProjectDto) {
    await this.assertOwn('profileProject', userId, id);
    const r = await this.prisma.profileProject.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description ?? null,
        techStack: dto.techStack ?? [],
        githubUrl: dto.githubUrl ?? null,
        liveUrl: dto.liveUrl ?? null,
      },
    });
    await this.recompute(userId);
    return r;
  }

  async deleteProject(userId: string, id: string) {
    await this.assertOwn('profileProject', userId, id);
    await this.prisma.profileProject.delete({ where: { id } });
    return this.recompute(userId);
  }

  // ----- skills (bulk create + delete by id) -------------------------------

  async createSkills(userId: string, body: SkillsBulkDto) {
    await this.ensureProfile(userId);
    const items = (body.items || [])
      .map((i) => ({ name: (i.name || '').trim(), category: i.category || null }))
      .filter((i) => i.name.length > 0 && i.name.length <= 80);
    if (!items.length) throw new BadRequestException('At least one skill name is required.');
    // createMany skips duplicates; UNIQUE(user_id, name) enforces dedupe.
    await this.prisma.profileSkill.createMany({
      data: items.map((i) => ({ userId, name: i.name, category: i.category })),
      skipDuplicates: true,
    });
    await this.recompute(userId);
    return this.prisma.profileSkill.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  async deleteSkill(userId: string, id: string) {
    await this.assertOwn('profileSkill', userId, id);
    await this.prisma.profileSkill.delete({ where: { id } });
    return this.recompute(userId);
  }

  // ----- certifications ----------------------------------------------------

  async createCertification(userId: string, dto: CertificationDto) {
    await this.ensureProfile(userId);
    const r = await this.prisma.profileCertification.create({
      data: {
        userId,
        name: dto.name,
        issuer: dto.issuer ?? null,
        issuedDate: dto.issuedDate ?? null,
        credentialUrl: dto.credentialUrl ?? null,
      },
    });
    await this.recompute(userId);
    return r;
  }

  async updateCertification(userId: string, id: string, dto: CertificationDto) {
    await this.assertOwn('profileCertification', userId, id);
    const r = await this.prisma.profileCertification.update({
      where: { id },
      data: {
        name: dto.name,
        issuer: dto.issuer ?? null,
        issuedDate: dto.issuedDate ?? null,
        credentialUrl: dto.credentialUrl ?? null,
      },
    });
    await this.recompute(userId);
    return r;
  }

  async deleteCertification(userId: string, id: string) {
    await this.assertOwn('profileCertification', userId, id);
    await this.prisma.profileCertification.delete({ where: { id } });
    return this.recompute(userId);
  }

  // ----- internals ---------------------------------------------------------

  private async recompute(userId: string) {
    const [p, experiences, education, projects, skills, certifications] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId } }),
      this.prisma.profileExperience.count({ where: { userId } }),
      this.prisma.profileEducation.count({ where: { userId } }),
      this.prisma.profileProject.count({ where: { userId } }),
      this.prisma.profileSkill.count({ where: { userId } }),
      this.prisma.profileCertification.count({ where: { userId } }),
    ]);
    if (!p) return this.get(userId);
    const pct = computeCompletion(
      {
        fullName: p.fullName,
        phone: p.phone,
        currentLocation: p.currentLocation,
        linkedinUrl: p.linkedinUrl,
        githubUrl: p.githubUrl,
        portfolioUrl: p.portfolioUrl,
        jobTitle: p.jobTitle,
        summary: p.summary,
        achievements: p.achievements,
        languages: p.languages,
        primaryResumeId: p.primaryResumeId,
      },
      { experiences, education, projects, skills, certifications },
    );
    await this.prisma.profile.update({ where: { userId }, data: { completionPct: pct } });
    return this.get(userId);
  }

  private async assertOwn(table: 'profileExperience' | 'profileEducation' | 'profileProject' | 'profileSkill' | 'profileCertification', userId: string, id: string) {
    const row: any = await (this.prisma as any)[table].findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    if (row.userId !== userId) throw new NotFoundException();
  }
}
