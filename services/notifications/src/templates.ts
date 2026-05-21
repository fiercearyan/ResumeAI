/**
 * Email templates. Plaintext-first (one HTML fallback per template).
 *
 * Each template receives a typed `data` object and returns
 * { subject, text, html }.
 */
export type TemplateId =
  | 'welcome'
  | 'mfa_enabled'
  | 'score_complete'
  | 'application_status_change'
  | 'application_awaiting_user'
  | 'account_deleted';

export interface Rendered {
  subject: string;
  text: string;
  html: string;
}

const APP_URL = process.env.WEB_PUBLIC_URL || 'http://localhost:3000';

function shell(title: string, body: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#0b1320;max-width:560px;margin:24px auto;padding:0 16px;">
<h2 style="color:#1f3a8a;margin:0 0 12px 0;">${title}</h2>
${body}
<p style="color:#888;font-size:12px;margin-top:32px;">— ResumeAI · <a href="${APP_URL}">${APP_URL}</a></p>
</body></html>`;
}

export function render(template: TemplateId, data: any): Rendered {
  switch (template) {
    case 'welcome': {
      const name = data?.fullName || data?.firstName || 'there';
      const subject = `Welcome to ResumeAI, ${name}!`;
      const text =
        `Hi ${name},\n\n` +
        `Welcome to ResumeAI. Get started by uploading your resume and pasting a job description — we'll score them, suggest improvements, and (if you want) apply on your behalf.\n\n` +
        `Open the app: ${APP_URL}\n\n` +
        `— ResumeAI`;
      return {
        subject,
        text,
        html: shell(
          subject,
          `<p>Hi ${name},</p>
           <p>Welcome to ResumeAI. Get started by uploading your resume and pasting a job description — we'll score them, suggest improvements, and (if you want) apply on your behalf.</p>
           <p><a href="${APP_URL}/dashboard" style="background:#1f3a8a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Open the app</a></p>`,
        ),
      };
    }
    case 'mfa_enabled': {
      const subject = 'Two-factor authentication enabled';
      const text =
        `Two-factor authentication is now enabled on your ResumeAI account.\n\n` +
        `If this wasn't you, sign in immediately and disable MFA from /settings/account or contact support.\n\n` +
        `— ResumeAI`;
      return {
        subject,
        text,
        html: shell(subject, `<p>Two-factor authentication is now enabled on your ResumeAI account.</p>
          <p>If this wasn't you, sign in immediately and disable MFA from <a href="${APP_URL}/settings/account">Account &amp; security</a> or contact support.</p>`),
      };
    }
    case 'score_complete': {
      const score = Math.round(data?.overall ?? 0);
      const jdTitle = data?.jdTitle || 'a job description';
      const scoreId = data?.scoreId;
      const subject = `ATS score for ${jdTitle}: ${score}/100`;
      const text =
        `Your ATS score against "${jdTitle}" is ${score}/100.\n\n` +
        (scoreId ? `View the breakdown: ${APP_URL}/score/${scoreId}\n\n` : '') +
        `— ResumeAI`;
      return {
        subject,
        text,
        html: shell(
          subject,
          `<p>Your ATS score against <b>${jdTitle}</b> is <b>${score}/100</b>.</p>` +
            (scoreId ? `<p><a href="${APP_URL}/score/${scoreId}">View the breakdown</a></p>` : ''),
        ),
      };
    }
    case 'application_awaiting_user': {
      const title = data?.jdTitle || 'your application';
      const appId = data?.applicationId;
      const subject = `Your application is awaiting review`;
      const text =
        `Your auto-apply for "${title}" filled the form and is paused before submit.\n\n` +
        `Review screenshots and approve: ${APP_URL}/applications/${appId}\n\n` +
        `— ResumeAI`;
      return {
        subject,
        text,
        html: shell(subject, `<p>Your auto-apply for <b>${title}</b> filled the form and is paused before submit.</p>
          <p><a href="${APP_URL}/applications/${appId}">Review and approve</a></p>`),
      };
    }
    case 'application_status_change': {
      const title = data?.jdTitle || 'your application';
      const status = data?.status || 'updated';
      const appId = data?.applicationId;
      const subject = `Application ${status}: ${title}`;
      const text =
        `Your application for "${title}" is now ${status}.\n\n` +
        (appId ? `View details: ${APP_URL}/applications/${appId}\n\n` : '') +
        `— ResumeAI`;
      return {
        subject,
        text,
        html: shell(subject, `<p>Your application for <b>${title}</b> is now <b>${status}</b>.</p>
          ${appId ? `<p><a href="${APP_URL}/applications/${appId}">View details</a></p>` : ''}`),
      };
    }
    case 'account_deleted': {
      const subject = 'Your ResumeAI account has been deleted';
      const text =
        `Your ResumeAI account and all associated data have been permanently deleted.\n\n` +
        `If this wasn't you, contact support immediately — though we can't recover deleted data, we can investigate.\n\n` +
        `— ResumeAI`;
      return {
        subject,
        text,
        html: shell(subject, `<p>Your ResumeAI account and all associated data have been permanently deleted.</p>
          <p>If this wasn't you, contact support immediately — though we can't recover deleted data, we can investigate.</p>`),
      };
    }
    default:
      throw new Error(`Unknown template: ${template}`);
  }
}
