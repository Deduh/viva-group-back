import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { RequestUser } from '../common/decorators/current-user.decorator';
import { resolvePagination } from '../common/utils/pagination';
import {
  sanitizeOptionalText,
  sanitizePlainText,
} from '../common/utils/sanitize';
import { MessagesGateway } from '../messages/messages.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { USER_SAFE_SELECT } from '../users/user-select';
import { CreateGroupTransportBookingDto } from './dto/create-group-transport-booking.dto';
import { GroupTransportListQueryDto } from './dto/group-transport-list-query.dto';
import { UpdateGroupTransportBookingDto } from './dto/update-group-transport-booking.dto';
import { UpdateGroupTransportStatusDto } from './dto/update-group-transport-status.dto';

const GROUP_BOOKING_INCLUDE = {
  user: { select: USER_SAFE_SELECT },
  segments: true,
};

@Injectable()
export class GroupTransportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessagesGateway,
  ) {}

  async findAll(query: GroupTransportListQueryDto, currentUser: RequestUser) {
    const { skip, take, page, limit } = resolvePagination({
      page: query.page,
      limit: query.limit,
    });

    const where: Prisma.GroupTransportBookingWhereInput = {};

    if (currentUser.role === Role.CLIENT) {
      where.userId = currentUser.sub;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.groupTransportBooking.findMany({
        where,
        include: GROUP_BOOKING_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.groupTransportBooking.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string, currentUser: RequestUser) {
    const booking = await this.prisma.groupTransportBooking.findUnique({
      where: { id },
      include: GROUP_BOOKING_INCLUDE,
    });

    if (!booking) {
      throw new NotFoundException('Group transport booking not found');
    }

    this.assertAccess(booking.userId, currentUser);

    return booking;
  }

  async create(dto: CreateGroupTransportBookingDto, currentUser: RequestUser) {
    const segments = dto.segments.map((segment) => ({
      ...segment,
      departureDate: new Date(segment.departureDate),
      flightNumber: sanitizePlainText(segment.flightNumber),
      from: sanitizePlainText(segment.from),
      to: sanitizePlainText(segment.to),
    }));

    return this.prisma.groupTransportBooking.create({
      data: {
        userId: currentUser.sub,
        note: sanitizeOptionalText(dto.note),
        segments: {
          create: segments,
        },
      },
      include: GROUP_BOOKING_INCLUDE,
    });
  }

  async updateStatus(id: string, dto: UpdateGroupTransportStatusDto) {
    await this.ensureExists(id);

    const updated = await this.prisma.groupTransportBooking.update({
      where: { id },
      data: { status: dto.status },
      include: GROUP_BOOKING_INCLUDE,
    });

    this.gateway.emitGroupTransportStatus(id, updated.status);

    return updated;
  }

  async update(
    id: string,
    dto: UpdateGroupTransportBookingDto,
    currentUser: RequestUser,
  ) {
    const booking = await this.prisma.groupTransportBooking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException('Group transport booking not found');
    }

    this.assertAccess(booking.userId, currentUser);

    if (dto.segments) {
      const segments = dto.segments.map((segment) => ({
        ...segment,
        departureDate: new Date(segment.departureDate),
        flightNumber: sanitizePlainText(segment.flightNumber),
        from: sanitizePlainText(segment.from),
        to: sanitizePlainText(segment.to),
      }));

      const [, updated] = await this.prisma.$transaction([
        this.prisma.groupTransportSegment.deleteMany({
          where: { bookingId: id },
        }),
        this.prisma.groupTransportBooking.update({
          where: { id },
          data: {
            note: dto.note,
            segments: { create: segments },
          },
          include: GROUP_BOOKING_INCLUDE,
        }),
      ]);

      return updated;
    }

    return this.prisma.groupTransportBooking.update({
      where: { id },
      data: { note: sanitizeOptionalText(dto.note) },
      include: GROUP_BOOKING_INCLUDE,
    });
  }

  private assertAccess(ownerId: string, currentUser: RequestUser) {
    if (currentUser.role === Role.CLIENT && ownerId !== currentUser.sub) {
      throw new ForbiddenException('Access denied');
    }
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.groupTransportBooking.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Group transport booking not found');
    }
  }
}
