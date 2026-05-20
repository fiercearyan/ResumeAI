import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { IsString } from 'class-validator';
import { JwtService } from '@nestjs/jwt';
import { MfaService } from './mfa.service';

class CodeDto {
  @IsString() code!: string;
}
class VerifyDto {
  @IsString() challenge!: string;
  @IsString() code!: string;
}

@Controller('mfa')
export class MfaController {
  constructor(private mfa: MfaService, private jwt: JwtService) {}

  @Post('enroll/start')
  async start(@Headers('authorization') auth?: string) {
    const userId = await this.userId(auth);
    return this.mfa.startEnroll(userId);
  }

  @Post('enroll/confirm')
  async confirm(@Body() body: CodeDto, @Headers('authorization') auth?: string) {
    const userId = await this.userId(auth);
    return this.mfa.confirmEnroll(userId, body.code);
  }

  @Post('disable')
  async disable(@Body() body: CodeDto, @Headers('authorization') auth?: string) {
    const userId = await this.userId(auth);
    return this.mfa.disable(userId, body.code);
  }

  @Post('verify')
  verify(@Body() body: VerifyDto) {
    return this.mfa.verifyChallenge(body.challenge, body.code);
  }

  private async userId(authHeader?: string): Promise<string> {
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException();
    const token = authHeader.slice('Bearer '.length);
    const payload = await this.jwt.verifyAsync<{ sub: string; typ: string }>(token, {
      secret: process.env.JWT_SECRET || 'dev-secret',
    });
    if (payload.typ !== 'access') throw new UnauthorizedException();
    return payload.sub;
  }
}
