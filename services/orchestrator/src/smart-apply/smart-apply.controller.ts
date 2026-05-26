import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsString, MaxLength } from 'class-validator';
import { AuthGuard } from '../common/auth.guard';
import { SmartApplyService } from './smart-apply.service';

class AnswerDto {
  @IsString() @MaxLength(2000) questionText!: string;
  @IsString() @MaxLength(8000) answerText!: string;
}

class AnswerPendingDto {
  @IsArray() answers!: Array<{ questionText: string; answerText: string }>;
}

@ApiTags('smart-apply')
@Controller()
export class SmartApplyController {
  constructor(private smart: SmartApplyService) {}

  // ----- Internal: hit by the auto-apply worker; NOT auth-gated.
  @Get('_internal/apply-context/:userId')
  applyContext(@Param('userId') userId: string) {
    return this.smart.applyContext(userId);
  }

  @Get('_internal/resolve-label/:userId')
  async resolve(@Param('userId') userId: string, @Req() req: any) {
    const label = String(req.query?.label || '');
    return this.smart.resolveLabel(userId, label);
  }

  // ----- User-facing: questionnaire management.
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('saved-answers')
  list(@Req() req: any) { return this.smart.listAnswers(req.user.id); }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Put('saved-answers')
  upsert(@Req() req: any, @Body() body: AnswerDto) {
    return this.smart.upsertAnswer(req.user.id, body.questionText, body.answerText);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Delete('saved-answers/:questionKey')
  remove(@Req() req: any, @Param('questionKey') key: string) {
    return this.smart.deleteAnswer(req.user.id, key);
  }

  // Internal: worker persists the questionnaire snapshot here.
  @Put('_internal/questionnaire/:applicationId')
  upsertQuestionnaire(@Param('applicationId') applicationId: string, @Body() body: any) {
    return this.smart.upsertQuestionnaire(applicationId, body);
  }

  // User-facing: load the questionnaire (used by /applications/[id]).
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('applications/:applicationId/questionnaire')
  getQuestionnaire(@Param('applicationId') applicationId: string) {
    return this.smart.getQuestionnaire(applicationId);
  }

  // User-facing: answer pending questions in bulk; answers are persisted
  // both into saved_answers (reused next app) and into this application's
  // questionnaire payload.
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('applications/:applicationId/answer-pending')
  answerPending(
    @Req() req: any,
    @Param('applicationId') applicationId: string,
    @Body() dto: AnswerPendingDto,
  ) {
    return this.smart.answerPending(req.user.id, applicationId, dto.answers);
  }
}
