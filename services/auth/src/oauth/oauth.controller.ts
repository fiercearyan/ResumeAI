import { Body, Controller, Get, Headers, Param, Post, Query, Res, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { OAuthService } from './oauth.service';
import type { ProviderKey } from './providers';

const WEB_BASE = process.env.WEB_PUBLIC_URL || 'http://localhost:3000';

@Controller('oauth')
export class OAuthController {
  constructor(private oauth: OAuthService, private jwt: JwtService) {}

  @Get('providers')
  list() {
    return { providers: this.oauth.enabledProviders() };
  }

  @Get(':provider/start')
  start(
    @Param('provider') provider: ProviderKey,
    @Query('redirect') redirect: string | undefined,
    @Res() res: Response,
  ) {
    const url = this.oauth.startAuthorize(provider, redirect);
    return res.redirect(url);
  }

  @Get(':provider/callback')
  async callback(
    @Param('provider') provider: ProviderKey,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const result = await this.oauth.handleCallback(provider, code, state);
    // Bounce back to the web app with a hash fragment carrying tokens (so it never hits the server logs).
    const params = new URLSearchParams();
    if ('mfaRequired' in result && result.mfaRequired) {
      params.set('mfa_challenge', (result as any).challenge);
    } else {
      const r = result as any;
      params.set('access', r.tokens.accessToken);
      params.set('refresh', r.tokens.refreshToken);
      params.set('user', encodeURIComponent(JSON.stringify(r.user)));
    }
    const target = (result as any).redirectAfter || '/dashboard';
    return res.redirect(`${WEB_BASE}/oauth/finish?next=${encodeURIComponent(target)}#${params.toString()}`);
  }

  @Get('identities')
  async identities(@Headers('authorization') auth?: string) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException();
    const token = auth.slice('Bearer '.length);
    const payload = await this.jwt.verifyAsync<{ sub: string; typ: string }>(token, {
      secret: process.env.JWT_SECRET || 'dev-secret',
    });
    if (payload.typ !== 'access') throw new UnauthorizedException();
    return this.oauth.listIdentities(payload.sub);
  }

  @Post(':provider/unlink')
  async unlink(@Param('provider') provider: ProviderKey, @Headers('authorization') auth?: string) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException();
    const token = auth.slice('Bearer '.length);
    const payload = await this.jwt.verifyAsync<{ sub: string; typ: string }>(token, {
      secret: process.env.JWT_SECRET || 'dev-secret',
    });
    if (payload.typ !== 'access') throw new UnauthorizedException();
    return this.oauth.unlink(payload.sub, provider);
  }
}
