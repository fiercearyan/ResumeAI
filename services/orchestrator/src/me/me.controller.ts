import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthGuard } from '../common/auth.guard';
import { MeService } from './me.service';

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('me')
export class MeController {
  constructor(private me: MeService) {}

  @Get('export')
  async export(@Req() req: any, @Res() res: Response) {
    const data = await this.me.export(req.user.id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="resumeai-export-${req.user.id.slice(0, 8)}.json"`);
    res.send(JSON.stringify(data, null, 2));
  }

  @Post('delete')
  async hardDelete(@Req() req: any) {
    return this.me.hardDelete(req.user.id);
  }
}
