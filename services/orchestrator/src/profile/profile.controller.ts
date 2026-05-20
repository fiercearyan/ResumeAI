import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../common/auth.guard';
import { ProfileService } from './profile.service';
import {
  CertificationDto,
  EducationDto,
  ExperienceDto,
  PatchProfileDto,
  ProjectDto,
  SkillsBulkDto,
} from './dto';

@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private profile: ProfileService) {}

  @Get()
  get(@Req() req: any) {
    return this.profile.get(req.user.id);
  }

  @Patch()
  patch(@Req() req: any, @Body() dto: PatchProfileDto) {
    return this.profile.patch(req.user.id, dto);
  }

  @Post('resume')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadResume(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.profile.uploadResume(req.user.id, file);
  }

  @Delete('resume')
  unsetResume(@Req() req: any) {
    return this.profile.unsetResume(req.user.id);
  }

  // experiences
  @Post('experiences')
  createExperience(@Req() req: any, @Body() dto: ExperienceDto) {
    return this.profile.createExperience(req.user.id, dto);
  }
  @Put('experiences/:id')
  updateExperience(@Req() req: any, @Param('id') id: string, @Body() dto: ExperienceDto) {
    return this.profile.updateExperience(req.user.id, id, dto);
  }
  @Delete('experiences/:id')
  deleteExperience(@Req() req: any, @Param('id') id: string) {
    return this.profile.deleteExperience(req.user.id, id);
  }

  // education
  @Post('education')
  createEducation(@Req() req: any, @Body() dto: EducationDto) {
    return this.profile.createEducation(req.user.id, dto);
  }
  @Put('education/:id')
  updateEducation(@Req() req: any, @Param('id') id: string, @Body() dto: EducationDto) {
    return this.profile.updateEducation(req.user.id, id, dto);
  }
  @Delete('education/:id')
  deleteEducation(@Req() req: any, @Param('id') id: string) {
    return this.profile.deleteEducation(req.user.id, id);
  }

  // projects
  @Post('projects')
  createProject(@Req() req: any, @Body() dto: ProjectDto) {
    return this.profile.createProject(req.user.id, dto);
  }
  @Put('projects/:id')
  updateProject(@Req() req: any, @Param('id') id: string, @Body() dto: ProjectDto) {
    return this.profile.updateProject(req.user.id, id, dto);
  }
  @Delete('projects/:id')
  deleteProject(@Req() req: any, @Param('id') id: string) {
    return this.profile.deleteProject(req.user.id, id);
  }

  // skills (bulk create / single delete)
  @Post('skills')
  createSkills(@Req() req: any, @Body() dto: SkillsBulkDto) {
    return this.profile.createSkills(req.user.id, dto);
  }
  @Delete('skills/:id')
  deleteSkill(@Req() req: any, @Param('id') id: string) {
    return this.profile.deleteSkill(req.user.id, id);
  }

  // certifications
  @Post('certifications')
  createCertification(@Req() req: any, @Body() dto: CertificationDto) {
    return this.profile.createCertification(req.user.id, dto);
  }
  @Put('certifications/:id')
  updateCertification(@Req() req: any, @Param('id') id: string, @Body() dto: CertificationDto) {
    return this.profile.updateCertification(req.user.id, id, dto);
  }
  @Delete('certifications/:id')
  deleteCertification(@Req() req: any, @Param('id') id: string) {
    return this.profile.deleteCertification(req.user.id, id);
  }
}
