import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { Response } from 'express';
import { AuthGuard } from '../common/auth.guard';
import { OptimizeQuotaGuard } from '../billing/quota.guard';
import { OptimizeService } from './optimize.service';

class CreateOptimizeDto {
  @IsUUID() resumeVersionId!: string;
  @IsUUID() jdId!: string;
}

@ApiTags('optimize')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('optimize')
export class OptimizeController {
  constructor(private optimize: OptimizeService) {}

  @Post()
  @UseGuards(OptimizeQuotaGuard)
  run(@Req() req: any, @Body() dto: CreateOptimizeDto) {
    return this.optimize.run(req.user.id, dto.resumeVersionId, dto.jdId);
  }

  @Get(':versionId')
  get(@Req() req: any, @Param('versionId') versionId: string) {
    return this.optimize.get(req.user.id, versionId);
  }

  @Get(':versionId/download.tex')
  async downloadLatex(@Req() req: any, @Param('versionId') versionId: string, @Res() res: Response) {
    const { filename, body } = await this.optimize.downloadLatex(req.user.id, versionId);
    res.setHeader('Content-Type', 'application/x-tex');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  }

  @Get(':versionId/download.pdf')
  async downloadPdf(@Req() req: any, @Param('versionId') versionId: string, @Res() res: Response) {
    const { filename, body } = await this.optimize.downloadPdf(req.user.id, versionId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  }

  @Post(':versionId/promote')
  promote(@Req() req: any, @Param('versionId') versionId: string) {
    return this.optimize.promote(req.user.id, versionId);
  }
}
