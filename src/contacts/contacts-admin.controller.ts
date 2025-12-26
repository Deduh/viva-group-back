import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { buildPagination } from '../common/utils/pagination';
import { ContactsService } from './contacts.service';
import { ContactsListQueryDto } from './dto/contacts-list-query.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('api/admin/contacts')
export class ContactsAdminController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  async list(@Query() query: ContactsListQueryDto) {
    const { items, total, page, limit } = await this.contactsService.listAdmin(
      query.page,
      query.limit,
    );

    return { items, total, pagination: buildPagination(page, limit, total) };
  }
}
