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

  /**
   * Authenticated link flow used by /settings/account.
   *
   * Returns the authorize URL in JSON (no redirect) so the frontend can pass
   * its Authorization header. We stash the user id in the OAuth state map;
   * the callback uses it to attach the new identity to the current user,
   * regardless of provider-email matching.
   */
  @Post(':provider/link-start')
  async linkStart(
    @Param('provider') provider: ProviderKey,
    @Body() body: { redirect?: string },
    @Headers('authorization') auth?: string,
  ) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException();
    const token = auth.slice('Bearer '.length);
    const payload = await this.jwt.verifyAsync<{ sub: string; typ: string }>(token, {
      secret: process.env.JWT_SECRET || 'dev-secret',
    });
    if (payload.typ !== 'access') throw new UnauthorizedException();
    const url = this.oauth.startAuthorize(provider, body?.redirect, payload.sub);
    return { authorizeUrl: url };
  }

  @Get(':provider/callback')
  async callback(
    @Param('provider') provider: ProviderKey,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const result: any = await this.oauth.handleCallback(provider, code, state);
    const params = new URLSearchParams();
    const target = result.redirectAfter || '/dashboard';
    if (result.linked) {
      // Authenticated link flow — user already has a session. Just signal
      // success and let the finish page navigate back without touching tokens.
      params.set('linked', '1');
      params.set('provider', String(result.provider || provider));
      return res.redirect(`${WEB_BASE}/oauth/finish?next=${encodeURIComponent(target)}#${params.toString()}`);
    }
    if (result.mfaRequired) {
      params.set('mfa_challenge', result.challenge);
    } else {
      params.set('access', result.tokens.accessToken);
      params.set('refresh', result.tokens.refreshToken);
      params.set('user', encodeURIComponent(JSON.stringify(result.user)));
    }
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
