import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { buildPagination } from '../common/utils/pagination';
import { CampaignListQueryDto } from './dto/campaign-list-query.dto';
import { MailingService } from './mailing.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('api/admin/mailing')
export class MailingAdminController {
  constructor(private readonly mailingService: MailingService) {}

  @Get('campaigns')
  async listCampaigns(@Query() query: CampaignListQueryDto) {
    const { items, total, page, limit } =
      await this.mailingService.listCampaigns(query);

    return { items, total, pagination: buildPagination(page, limit, total) };
  }

  @Get('campaigns/:id/logs')
  logs(@Param('id') id: string) {
    return this.mailingService.listCampaignLogs(id);
  }
}
