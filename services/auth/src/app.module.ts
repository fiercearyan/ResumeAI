import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DbService } from './db.service';
import { OAuthController } from './oauth/oauth.controller';
import { OAuthService } from './oauth/oauth.service';
import { MfaController } from './mfa/mfa.controller';
import { MfaService } from './mfa/mfa.service';
import { RateLimitMiddleware } from './common/rate-limit.middleware';
import { SecurityHeadersMiddleware } from './common/security-headers.middleware';
import { MiddlewareConsumer, NestModule } from '@nestjs/common';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: `${process.env.JWT_ACCESS_TTL_SEC || 900}s` },
    }),
  ],
  controllers: [AuthController, OAuthController, MfaController],
  providers: [AuthService, OAuthService, MfaService, DbService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityHeadersMiddleware).forRoutes('*');
    // Apply to every route and let the middleware decide via its LIMITS map
    // which keys to actually count. Simpler than fighting Nest's forRoutes
    // path-prefix semantics.
    consumer.apply(RateLimitMiddleware).forRoutes('*');
  }
}
