import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DbService } from './db.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: `${process.env.JWT_ACCESS_TTL_SEC || 900}s` },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, DbService],
})
export class AppModule {}
