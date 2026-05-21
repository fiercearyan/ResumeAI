'use client';
import { useAuth } from './auth-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const AUTH_BASE = process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4001';

export interface ApiError extends Error {
  status: number;
  body?: any;
}

async function req<T>(path: string, init: RequestInit = {}, opts: { base?: string; auth?: boolean } = {}): Promise<T> {
  const base = opts.base || `${API_BASE}/api`;
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (opts.auth !== false) {
    const token = useAuth.getState().accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(`${base}${path}`, { ...init, headers, cache: 'no-store' });
  if (!res.ok) {
    let body: any = undefined;
    try { body = await res.json(); } catch {}
    const err = new Error(body?.message || body?.detail || `HTTP ${res.status}`) as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
  }
  if (res.status === 204) return undefined as any;
  return res.json() as Promise<T>;
}

export const api = {
  // auth
  signup: (email: string, password: string, fullName?: string) =>
    req<{ user: any; tokens: any }>('/signup', { method: 'POST', body: JSON.stringify({ email, password, fullName }) }, { base: `${AUTH_BASE}/auth`, auth: false }),
  login: (email: string, password: string) =>
    req<{ user: any; tokens: any }>('/login', { method: 'POST', body: JSON.stringify({ email, password }) }, { base: `${AUTH_BASE}/auth`, auth: false }),
  me: () => req<any>('/me', {}, { base: `${AUTH_BASE}/auth` }),

  // resumes
  uploadResume: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return req<any>('/resumes', { method: 'POST', body: fd });
  },
  listResumes: () => req<any[]>('/resumes'),
  getResume: (id: string) => req<any>(`/resumes/${id}`),

  // jds
  createJd: (type: 'url' | 'text', payload: string) =>
    req<any>('/jds', { method: 'POST', body: JSON.stringify({ type, payload }) }),
  listJds: () => req<any[]>('/jds'),
  getJd: (id: string) => req<any>(`/jds/${id}`),

  // score
  runScore: (resumeVersionId: string, jdId: string) =>
    req<any>('/score', { method: 'POST', body: JSON.stringify({ resumeVersionId, jdId }) }),
  getScore: (id: string) => req<any>(`/score/${id}`),

  // optimize
  runOptimize: (resumeVersionId: string, jdId: string) =>
    req<any>('/optimize', { method: 'POST', body: JSON.stringify({ resumeVersionId, jdId }) }),
  getOptimize: (versionId: string) => req<any>(`/optimize/${versionId}`),
  downloadOptimizedUrl: (versionId: string, format: 'pdf' | 'tex') =>
    `${API_BASE}/api/optimize/${versionId}/download.${format}`,
  promoteVersion: (versionId: string) =>
    req<any>(`/optimize/${versionId}/promote`, { method: 'POST' }),

  // apply
  createApplication: (jdId: string, resumeVersionId: string, mode: 'review' | 'auto' = 'review') =>
    req<any>('/apply', { method: 'POST', body: JSON.stringify({ jdId, resumeVersionId, mode }) }),
  listApplications: (status?: string) =>
    req<any[]>(`/apply${status ? `?status=${status}` : ''}`),
  getApplication: (id: string) => req<any>(`/apply/${id}`),
  approveApplication: (id: string) => req<any>(`/apply/${id}/approve`, { method: 'POST' }),
  cancelApplication: (id: string) => req<any>(`/apply/${id}/cancel`, { method: 'POST' }),

  // preferences
  getPreferences: () => req<any>('/preferences'),
  updatePreferences: (patch: any) =>
    req<any>('/preferences', { method: 'PATCH', body: JSON.stringify(patch) }),

  // profile
  getProfile: () => req<any>('/profile'),
  patchProfile: (b: any) => req<any>('/profile', { method: 'PATCH', body: JSON.stringify(b) }),
  uploadProfileResume: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return req<any>('/profile/resume', { method: 'POST', body: fd });
  },
  unsetProfileResume: () => req<any>('/profile/resume', { method: 'DELETE' }),

  createExperience: (b: any) => req<any>('/profile/experiences', { method: 'POST', body: JSON.stringify(b) }),
  updateExperience: (id: string, b: any) => req<any>(`/profile/experiences/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteExperience: (id: string) => req<any>(`/profile/experiences/${id}`, { method: 'DELETE' }),

  createEducation: (b: any) => req<any>('/profile/education', { method: 'POST', body: JSON.stringify(b) }),
  updateEducation: (id: string, b: any) => req<any>(`/profile/education/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteEducation: (id: string) => req<any>(`/profile/education/${id}`, { method: 'DELETE' }),

  createProject: (b: any) => req<any>('/profile/projects', { method: 'POST', body: JSON.stringify(b) }),
  updateProject: (id: string, b: any) => req<any>(`/profile/projects/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteProject: (id: string) => req<any>(`/profile/projects/${id}`, { method: 'DELETE' }),

  createSkills: (items: Array<{ name: string; category?: string }>) =>
    req<any>('/profile/skills', { method: 'POST', body: JSON.stringify({ items }) }),
  deleteSkill: (id: string) => req<any>(`/profile/skills/${id}`, { method: 'DELETE' }),

  createCertification: (b: any) => req<any>('/profile/certifications', { method: 'POST', body: JSON.stringify(b) }),
  updateCertification: (id: string, b: any) => req<any>(`/profile/certifications/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteCertification: (id: string) => req<any>(`/profile/certifications/${id}`, { method: 'DELETE' }),

  // OAuth (calls auth service directly)
  listProviders: () =>
    req<{ providers: { key: string; enabled: boolean }[] }>('/providers', {}, { base: `${AUTH_BASE}/auth/oauth`, auth: false }),
  oauthStartUrl: (provider: string, redirectAfter?: string) =>
    `${AUTH_BASE}/auth/oauth/${provider}/start${redirectAfter ? `?redirect=${encodeURIComponent(redirectAfter)}` : ''}`,
  /** Authenticated link flow — call this from /settings/account, then navigate
   *  the browser to the returned authorizeUrl. Carries the user identity in
   *  server-side OAuth state so the callback links to the current user. */
  oauthLinkStart: (provider: string, redirectAfter?: string) =>
    req<{ authorizeUrl: string }>(
      `/${provider}/link-start`,
      { method: 'POST', body: JSON.stringify({ redirect: redirectAfter }) },
      { base: `${AUTH_BASE}/auth/oauth` },
    ),
  listIdentities: () => req<any[]>('/identities', {}, { base: `${AUTH_BASE}/auth/oauth` }),
  unlinkIdentity: (provider: string) =>
    req<any>(`/${provider}/unlink`, { method: 'POST' }, { base: `${AUTH_BASE}/auth/oauth` }),

  // MFA
  mfaEnrollStart: () =>
    req<{ otpauthUrl: string; secret: string }>('/enroll/start', { method: 'POST' }, { base: `${AUTH_BASE}/auth/mfa` }),
  mfaEnrollConfirm: (code: string) =>
    req<{ ok: boolean; backupCodes: string[] }>('/enroll/confirm', {
      method: 'POST', body: JSON.stringify({ code }),
    }, { base: `${AUTH_BASE}/auth/mfa` }),
  mfaDisable: (code: string) =>
    req<any>('/disable', { method: 'POST', body: JSON.stringify({ code }) }, { base: `${AUTH_BASE}/auth/mfa` }),
  mfaVerify: (challenge: string, code: string) =>
    req<any>('/verify', { method: 'POST', body: JSON.stringify({ challenge, code }) }, { base: `${AUTH_BASE}/auth/mfa`, auth: false }),

  // Me (GDPR)
  exportMeUrl: () => `${API_BASE}/api/me/export`,
  deleteMe: () => req<any>('/me/delete', { method: 'POST' }),

  // Billing
  getBillingStatus: () => req<any>('/billing/status'),
  startCheckout: (plan: 'pro') =>
    req<{ url: string; mock: boolean }>('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
  openBillingPortal: () => req<{ url: string; mock: boolean }>('/billing/portal', { method: 'POST' }),
};
