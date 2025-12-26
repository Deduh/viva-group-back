import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  CurrentUser,
  RequestUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { buildPagination } from '../common/utils/pagination';
import { AdminService } from './admin.service';
import { CreateManagerDto } from './dto/create-manager.dto';
import { ManagerListQueryDto } from './dto/manager-list-query.dto';
import { UpdateManagerDto } from './dto/update-manager.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('api/admin/managers')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async list(@Query() query: ManagerListQueryDto) {
    const { items, total, page, limit } =
      await this.adminService.listManagers(query);

    return { items, total, pagination: buildPagination(page, limit, total) };
  }

  @Post()
  create(@Body() dto: CreateManagerDto, @CurrentUser() user: RequestUser) {
    return this.adminService.createManager(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateManagerDto) {
    return this.adminService.updateManager(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('hard') hard?: string) {
    return this.adminService.deleteManager(id, hard === 'true');
  }
}
