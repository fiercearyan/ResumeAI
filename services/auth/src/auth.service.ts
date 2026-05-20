import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { DbService } from './db.service';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
}

@Injectable()
export class AuthService {
  constructor(private db: DbService, private jwt: JwtService) {}

  async signup(email: string, password: string, fullName?: string): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const normEmail = email.trim().toLowerCase();
    const existing = await this.db.query('SELECT id FROM users WHERE email = $1', [normEmail]);
    if (existing.rowCount && existing.rowCount > 0) {
      throw new ConflictException('Email already registered');
    }
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    const inserted = await this.db.query<{ id: string; email: string; full_name: string | null }>(
      'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name',
      [normEmail, hash, fullName ?? null],
    );
    const user = this.toAuthUser(inserted.rows[0]);
    const tokens = this.issueTokens(user);
    return { user, tokens };
  }

  async login(email: string, password: string): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const normEmail = email.trim().toLowerCase();
    const res = await this.db.query<{ id: string; email: string; full_name: string | null; password_hash: string }>(
      'SELECT id, email, full_name, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL',
      [normEmail],
    );
    if (!res.rowCount) throw new UnauthorizedException('Invalid credentials');
    const row = res.rows[0];
    const ok = await argon2.verify(row.password_hash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const user = this.toAuthUser(row);
    return { user, tokens: this.issueTokens(user) };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string; typ: string }>(refreshToken, {
        secret: process.env.JWT_SECRET || 'dev-secret',
      });
      if (payload.typ !== 'refresh') throw new Error('Wrong token type');
      return this.issueTokens({ id: payload.sub, email: payload.email, fullName: null });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async me(userId: string): Promise<AuthUser> {
    const res = await this.db.query<{ id: string; email: string; full_name: string | null }>(
      'SELECT id, email, full_name FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId],
    );
    if (!res.rowCount) throw new UnauthorizedException();
    return this.toAuthUser(res.rows[0]);
  }

  private toAuthUser(row: { id: string; email: string; full_name: string | null }): AuthUser {
    return { id: row.id, email: row.email, fullName: row.full_name };
  }

  private issueTokens(user: AuthUser): TokenPair {
    const accessTtl = parseInt(process.env.JWT_ACCESS_TTL_SEC || '900', 10);
    const refreshTtl = parseInt(process.env.JWT_REFRESH_TTL_SEC || '604800', 10);
    const access = this.jwt.sign(
      { sub: user.id, email: user.email, typ: 'access' },
      { expiresIn: `${accessTtl}s` },
    );
    const refresh = this.jwt.sign(
      { sub: user.id, email: user.email, typ: 'refresh' },
      { expiresIn: `${refreshTtl}s` },
    );
    return { accessToken: access, refreshToken: refresh, expiresIn: accessTtl };
  }
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
