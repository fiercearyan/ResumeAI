import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { AuthGuard } from '../common/auth.guard';
import { ApplyService } from './apply.service';

class CreateApplyDto {
  @IsUUID() jdId!: string;
  @IsUUID() resumeVersionId!: string;
  @IsOptional() @IsIn(['review', 'auto']) mode?: 'review' | 'auto';
}

@ApiTags('apply')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('apply')
export class ApplyController {
  constructor(private apply: ApplyService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateApplyDto) {
    return this.apply.create(req.user.id, dto);
  }

  @Get()
  list(@Req() req: any, @Query('status') status?: string) {
    return this.apply.list(req.user.id, { status });
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.apply.get(req.user.id, id);
  }

  @Post(':id/approve')
  approve(@Req() req: any, @Param('id') id: string) {
    return this.apply.approve(req.user.id, id);
  }

  @Post(':id/cancel')
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.apply.cancel(req.user.id, id);
  }
}
