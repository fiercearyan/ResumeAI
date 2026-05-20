/**
 * Profile completion calculator.
 *
 * Deterministic. Each weighted check contributes to the total when its field
 * is "filled" by the rule below. Weights sum to exactly 100.
 */
export interface ProfileForCompletion {
  fullName?: string | null;
  phone?: string | null;
  currentLocation?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  jobTitle?: string | null;
  summary?: string | null;
  achievements?: string | null;
  languages?: unknown;
  primaryResumeId?: string | null;
}

export interface CompletionCounts {
  experiences: number;
  education: number;
  projects: number;
  skills: number;
  certifications: number;
}

interface Check {
  weight: number;
  filled: boolean;
}

export function computeCompletion(p: ProfileForCompletion, c: CompletionCounts): number {
  const langArr = Array.isArray(p.languages) ? (p.languages as unknown[]) : [];
  const checks: Check[] = [
    { weight: 5, filled: nonEmpty(p.fullName) },
    { weight: 5, filled: nonEmpty(p.phone) },
    { weight: 5, filled: nonEmpty(p.currentLocation) },
    { weight: 5, filled: nonEmpty(p.linkedinUrl) },
    { weight: 4, filled: nonEmpty(p.githubUrl) },
    { weight: 2, filled: nonEmpty(p.portfolioUrl) },
    { weight: 5, filled: nonEmpty(p.jobTitle) },
    { weight: 8, filled: (p.summary ?? '').trim().length >= 50 },
    { weight: 4, filled: nonEmpty(p.achievements) },
    { weight: 3, filled: langArr.length > 0 },
    { weight: 8, filled: c.skills > 0 },
    { weight: 3, filled: c.certifications > 0 },
    { weight: 10, filled: !!p.primaryResumeId },
    { weight: 12, filled: c.experiences > 0 },
    { weight: 10, filled: c.education > 0 },
    { weight: 11, filled: c.projects > 0 },
  ];

  const total = checks.reduce((s, x) => s + (x.filled ? x.weight : 0), 0);
  // Defensive cap.
  return Math.max(0, Math.min(100, total));
}

function nonEmpty(v?: string | null): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}
