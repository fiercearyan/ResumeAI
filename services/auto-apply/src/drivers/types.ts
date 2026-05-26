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

/** Snapshot of profile + saved answers + mappings fetched from the orchestrator. */
export interface ApplyContext {
  scope: any;                                  // nested {user, profile, ...}
  savedAnswers: Array<{ questionKey: string; questionText: string; answerText: string }>;
  mappings: Array<{ labelPattern: string; profileField: string; confidence: number }>;
  primaryResume: { id: string; sourceType: string; s3Key: string } | null;
}

/** A question the driver couldn't auto-answer; surfaced to the user in awaiting_user. */
export interface PendingQuestion {
  label: string;
  questionKey: string;
  kind: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file' | 'unknown';
  options?: string[];                          // for select/radio
  required?: boolean;
}

/** Per-field fill result the driver records as a `field_filled` event. */
export interface FillResult {
  label: string;
  profileField: string | null;
  confidence: number;
  source: 'saved_answer' | 'profile' | 'field_mapping' | 'unmatched';
  filled: boolean;
}

export interface DriverContext {
  page: Page;
  jdUrl: string;
  profile: UserProfile;
  applyContext: ApplyContext;
  resumePdfPath: string;
  /** Take a screenshot, store it in MinIO, and record an apply_event row. */
  screenshot(label: string, opts?: { fullPage?: boolean }): Promise<string>;
  /** Record a non-screenshot event (e.g. "opened page", "captcha detected"). */
  event(step: string, opts?: { ok?: boolean; message?: string; meta?: any }): Promise<void>;
}

export interface FillFormResult {
  filled: FillResult[];
  pending: PendingQuestion[];
}

export interface ApplyDriver {
  name: string;
  canHandle(url: string): boolean;
  /** Walk the form up to (but not including) the final submit click.
   *  Returns the structured fill result so the worker can decide whether to
   *  pause for pending questions. */
  fillForm(ctx: DriverContext): Promise<FillFormResult>;
  /** Click submit and return any provider-visible confirmation token/url. */
  submit(ctx: DriverContext): Promise<{ externalId?: string; confirmationText?: string }>;
}
