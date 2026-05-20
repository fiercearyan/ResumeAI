import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { AuthGuard } from '../common/auth.guard';
import { ScoreService } from './score.service';

class CreateScoreDto {
  @IsUUID() resumeVersionId!: string;
  @IsUUID() jdId!: string;
}

@ApiTags('score')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('score')
export class ScoreController {
  constructor(private score: ScoreService) {}

  @Post()
  run(@Req() req: any, @Body() dto: CreateScoreDto) {
    return this.score.runScore(req.user.id, dto.resumeVersionId, dto.jdId);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.score.get(req.user.id, id);
  }

  @Get()
  listForResume(@Req() req: any, @Query('resumeId') resumeId: string) {
    return this.score.listForResume(req.user.id, resumeId);
  }
}
