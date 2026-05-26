import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../common/auth.guard';
import { LlmService } from './llm.service';

@ApiTags('llm')
@Controller()
export class LlmController {
  constructor(private llm: LlmService) {}

  /**
   * Internal sink for Python services. NOT auth-gated — services post their
   * own usage. Reachable from inside the docker network only (the port
   * mapping doesn't matter; we just don't enforce auth here).
   */
  @Post('_internal/llm-usage')
  record(@Body() body: any) {
    return this.llm.record(body);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('me/llm-usage')
  forMe(@Req() req: any) {
    return this.llm.forUser(req.user.id);
  }
}
