import type { Page } from 'playwright';

export interface UserProfile {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  city?: string | null;
  countryCode?: string | null;
  workAuth?: string | null;
  needsSponsorship?: boolean | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
}

export interface DriverContext {
  page: Page;
  jdUrl: string;
  profile: UserProfile;
  resumePdfPath: string;
  /** Take a screenshot, store it in MinIO, and record an apply_event row. */
  screenshot(label: string, opts?: { fullPage?: boolean }): Promise<string>;
  /** Record a non-screenshot event (e.g. "opened page", "captcha detected"). */
  event(step: string, opts?: { ok?: boolean; message?: string; meta?: any }): Promise<void>;
}

export interface ApplyDriver {
  name: string;
  canHandle(url: string): boolean;
  /** Walk the form up to (but not including) the final submit click. */
  fillForm(ctx: DriverContext): Promise<void>;
  /** Click submit and return any provider-visible confirmation token/url. */
  submit(ctx: DriverContext): Promise<{ externalId?: string; confirmationText?: string }>;
}
