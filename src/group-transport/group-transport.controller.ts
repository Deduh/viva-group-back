import {
  Body,
  Controller,
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
import { CreateGroupTransportBookingDto } from './dto/create-group-transport-booking.dto';
import { GroupTransportListQueryDto } from './dto/group-transport-list-query.dto';
import { UpdateGroupTransportBookingDto } from './dto/update-group-transport-booking.dto';
import { UpdateGroupTransportStatusDto } from './dto/update-group-transport-status.dto';
import { GroupTransportService } from './group-transport.service';

@ApiTags('group-transport')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/group-transport/bookings')
export class GroupTransportController {
  constructor(private readonly groupTransportService: GroupTransportService) {}

  @Get()
  async list(
    @Query() query: GroupTransportListQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const { items, total, page, limit } =
      await this.groupTransportService.findAll(query, user);

    return { items, total, pagination: buildPagination(page, limit, total) };
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.groupTransportService.findOne(id, user);
  }

  @Post()
  create(
    @Body() dto: CreateGroupTransportBookingDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.groupTransportService.create(dto, user);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.MANAGER)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGroupTransportStatusDto,
  ) {
    return this.groupTransportService.updateStatus(id, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGroupTransportBookingDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.groupTransportService.update(id, dto, user);
  }
}
