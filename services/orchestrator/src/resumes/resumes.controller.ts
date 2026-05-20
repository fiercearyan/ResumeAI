import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../common/auth.guard';
import { ResumesService } from './resumes.service';

@ApiTags('resumes')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('resumes')
export class ResumesController {
  constructor(private resumes: ResumesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.resumes.upload(req.user.id, file);
  }

  @Get()
  list(@Req() req: any) {
    return this.resumes.list(req.user.id);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.resumes.get(req.user.id, id);
  }
}
