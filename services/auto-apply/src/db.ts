import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function recordEvent(
  applicationId: string,
  step: string,
  opts: { ok?: boolean; message?: string; screenshotS3?: string; meta?: any } = {},
) {
  await prisma.applyEvent.create({
    data: {
      applicationId,
      step,
      ok: opts.ok ?? true,
      message: opts.message ?? null,
      screenshotS3: opts.screenshotS3 ?? null,
      meta: opts.meta ?? undefined,
    },
  });
}

export async function setStatus(
  applicationId: string,
  status: string,
  patch: { externalId?: string; lastError?: string; submittedAt?: Date } = {},
) {
  await prisma.application.update({
    where: { id: applicationId },
    data: {
      status,
      ...patch,
      attempts: { increment: status === 'failed' ? 1 : 0 },
    },
  });
}
