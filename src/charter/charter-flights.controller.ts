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
import { CharterFlightsService } from './charter-flights.service';
import { CharterFlightListQueryDto } from './dto/charter-flight-list-query.dto';
import { CreateCharterFlightDto } from './dto/create-charter-flight.dto';
import { UpdateCharterFlightDto } from './dto/update-charter-flight.dto';

@ApiTags('charter')
@Controller('api/charter/flights')
export class CharterFlightsController {
  constructor(private readonly flightsService: CharterFlightsService) {}

  @Get()
  async list(@Query() query: CharterFlightListQueryDto) {
    const { items, total, page, limit } =
      await this.flightsService.findAllPublic(query);

    return { items, total, pagination: buildPagination(page, limit, total) };
  }

  @Get('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async listAdmin(@Query() query: CharterFlightListQueryDto) {
    const { items, total, page, limit } =
      await this.flightsService.findAllAdmin(query);

    return { items, total, pagination: buildPagination(page, limit, total) };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.flightsService.findOnePublic(id);
  }

  @Get('admin/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  findOneAdmin(@Param('id') id: string) {
    return this.flightsService.findOneAdmin(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  create(
    @Body() dto: CreateCharterFlightDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.flightsService.create(dto, user);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateCharterFlightDto) {
    return this.flightsService.update(id, dto);
  }
}
