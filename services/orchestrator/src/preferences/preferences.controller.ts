import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../common/auth.guard';
import { PreferencesService } from './preferences.service';

@ApiTags('preferences')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('preferences')
export class PreferencesController {
  constructor(private prefs: PreferencesService) {}

  @Get()
  get(@Req() req: any) {
    return this.prefs.get(req.user.id);
  }

  @Patch()
  patch(@Req() req: any, @Body() body: any) {
    return this.prefs.patch(req.user.id, body);
  }
}
