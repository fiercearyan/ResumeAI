import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './common/prisma.service';
import { MongoService } from './common/mongo.service';
import { S3Service } from './common/s3.service';
import { AuthGuard } from './common/auth.guard';
import { ResumesController } from './resumes/resumes.controller';
import { ResumesService } from './resumes/resumes.service';
import { JdsController } from './jds/jds.controller';
import { JdsService } from './jds/jds.service';
import { ScoreController } from './score/score.controller';
import { ScoreService } from './score/score.service';
import { ScoreGateway } from './score/score.gateway';
import { OptimizeController } from './optimize/optimize.controller';
import { OptimizeService } from './optimize/optimize.service';
import { ApplyController } from './apply/apply.controller';
import { ApplyService } from './apply/apply.service';
import { PreferencesController } from './preferences/preferences.controller';
import { PreferencesService } from './preferences/preferences.service';
import { HealthController } from './health.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [
    HealthController,
    ResumesController,
    JdsController,
    ScoreController,
    OptimizeController,
    ApplyController,
    PreferencesController,
  ],
  providers: [
    PrismaService,
    MongoService,
    S3Service,
    AuthGuard,
    ResumesService,
    JdsService,
    ScoreService,
    ScoreGateway,
    OptimizeService,
    ApplyService,
    PreferencesService,
  ],
})
export class AppModule {}
