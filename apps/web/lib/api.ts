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
};
