'use client';
import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  fullName?: string | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  hydrated: boolean;
  hydrate(): void;
  setSession(tokens: { accessToken: string; refreshToken: string }, user: User): void;
  clear(): void;
}

const TOKEN_KEY = 'resumeai_auth';

export const useAuth = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  hydrated: false,
  hydrate() {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({ ...parsed, hydrated: true });
        return;
      }
    } catch {}
    set({ hydrated: true });
  },
  setSession(tokens, user) {
    const next = { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(next));
    set({ ...next, hydrated: true });
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));
