import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';

const AUTH_BASE = `http://auth:${process.env.AUTH_PORT || 4001}/auth`;

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    const token = header.slice('Bearer '.length);
    try {
      const r = await axios.post(`${AUTH_BASE}/verify`, { token }, { timeout: 4000 });
      req.user = { id: r.data.userId, email: r.data.email };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
