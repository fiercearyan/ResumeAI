import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { AuthGuard } from '../common/auth.guard';
import { JdsService } from './jds.service';

class CreateJdDto {
  @IsIn(['url', 'text']) type!: 'url' | 'text';
  @IsString() payload!: string;
}

@ApiTags('jds')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('jds')
export class JdsController {
  constructor(private jds: JdsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateJdDto) {
    return this.jds.create(req.user.id, dto);
  }

  @Get()
  list(@Req() req: any) {
    return this.jds.list(req.user.id);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.jds.get(req.user.id, id);
  }
}
