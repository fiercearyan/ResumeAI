import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

class SignupDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsString() fullName?: string;
}
class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}
class RefreshDto {
  @IsString() refreshToken!: string;
}
class VerifyDto {
  @IsString() token!: string;
}

@Controller()
export class AuthController {
  constructor(private auth: AuthService, private jwt: JwtService) {}

  @Post('signup')
  signup(@Body() body: SignupDto) {
    return this.auth.signup(body.email, body.password, body.fullName);
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refreshToken);
  }

  // Used by the orchestrator's JWT guard to validate an incoming access token.
  @Post('verify')
  async verify(@Body() body: VerifyDto) {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string; typ: string }>(body.token, {
        secret: process.env.JWT_SECRET || 'dev-secret',
      });
      if (payload.typ !== 'access') throw new Error();
      return { valid: true, userId: payload.sub, email: payload.email };
    } catch {
      throw new UnauthorizedException();
    }
  }

  @Get('me')
  async me(@Headers('authorization') auth?: string) {
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException();
    const token = auth.slice('Bearer '.length);
    const payload = await this.jwt.verifyAsync<{ sub: string; typ: string }>(token, {
      secret: process.env.JWT_SECRET || 'dev-secret',
    });
    if (payload.typ !== 'access') throw new UnauthorizedException();
    return this.auth.me(payload.sub);
  }

  @Get('health')
  health() {
    return { ok: true, service: 'auth' };
  }
}
