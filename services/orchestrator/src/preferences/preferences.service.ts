import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class PreferencesService {
  constructor(private prisma: PrismaService) {}

  async get(userId: string) {
    let p = await this.prisma.userPreference.findUnique({ where: { userId } });
    if (!p) {
      p = await this.prisma.userPreference.create({ data: { userId } });
    }
    return p;
  }

  async patch(userId: string, body: any) {
    await this.get(userId); // ensure row exists
    return this.prisma.userPreference.update({
      where: { userId },
      data: {
        firstName: body.firstName ?? undefined,
        lastName: body.lastName ?? undefined,
        phone: body.phone ?? undefined,
        city: body.city ?? undefined,
        countryCode: body.countryCode ?? undefined,
        workAuth: body.workAuth ?? undefined,
        needsSponsorship: typeof body.needsSponsorship === 'boolean' ? body.needsSponsorship : undefined,
        linkedinUrl: body.linkedinUrl ?? undefined,
        githubUrl: body.githubUrl ?? undefined,
        portfolioUrl: body.portfolioUrl ?? undefined,
        autoApplyEnabled: typeof body.autoApplyEnabled === 'boolean' ? body.autoApplyEnabled : undefined,
        defaultMode: body.defaultMode ?? undefined,
        minAtsScore: typeof body.minAtsScore === 'number' ? body.minAtsScore : undefined,
        dailyApplyCap: typeof body.dailyApplyCap === 'number' ? body.dailyApplyCap : undefined,
        questionBank: body.questionBank ?? undefined,
      },
    });
  }
}
