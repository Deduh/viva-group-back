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
import { CharterBookingsService } from './charter-bookings.service';
import { CharterBookingListQueryDto } from './dto/charter-booking-list-query.dto';
import { CreateCharterBookingDto } from './dto/create-charter-booking.dto';
import { UpdateCharterStatusDto } from './dto/update-charter-status.dto';

@ApiTags('charter')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/charter/bookings')
export class CharterBookingsController {
  constructor(private readonly charterService: CharterBookingsService) {}

  @Get()
  async list(
    @Query() query: CharterBookingListQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const { items, total, page, limit } = await this.charterService.findAll(
      query,
      user,
    );

    return { items, total, pagination: buildPagination(page, limit, total) };
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.charterService.findOne(id, user);
  }

  @Post()
  create(
    @Body() dto: CreateCharterBookingDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.charterService.create(dto, user);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.MANAGER)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateCharterStatusDto) {
    return this.charterService.updateStatus(id, dto);
  }
}
