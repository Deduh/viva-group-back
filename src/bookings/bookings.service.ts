import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma, Role } from '@prisma/client';
import { RequestUser } from '../common/decorators/current-user.decorator';
import { resolvePagination } from '../common/utils/pagination';
import { sanitizeOptionalText } from '../common/utils/sanitize';
import { MessagesGateway } from '../messages/messages.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { TOUR_SELECT } from '../tours/tour-select';
import { USER_SAFE_SELECT } from '../users/user-select';
import { BookingListQueryDto } from './dto/booking-list-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

const BOOKING_INCLUDE = {
  user: { select: USER_SAFE_SELECT },
  tour: { select: TOUR_SELECT },
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessagesGateway,
  ) {}

  async findAll(query: BookingListQueryDto, currentUser: RequestUser) {
    const { skip, take, page, limit } = resolvePagination({
      page: query.page,
      limit: query.limit,
    });

    const where: Prisma.BookingWhereInput = {};

    if (currentUser.role === Role.CLIENT) {
      where.userId = currentUser.sub;
    } else if (query.userId) {
      where.userId = query.userId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.tourId) {
      where.tourId = query.tourId;
    }

    if (query.dateFrom || query.dateTo) {
      where.startDate = {};

      if (query.dateFrom) {
        where.startDate.gte = new Date(query.dateFrom);
      }

      if (query.dateTo) {
        where.startDate.lte = new Date(query.dateTo);
      }
    }

    if (query.search) {
      where.OR = [
        { notes: { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
        { user: { name: { contains: query.search, mode: 'insensitive' } } },
        {
          tour: {
            destination: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string, currentUser: RequestUser) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    this.assertAccess(booking.userId, currentUser);

    return booking;
  }

  async create(dto: CreateBookingDto, currentUser: RequestUser) {
    const userId = this.resolveUserId(dto.userId, currentUser);
    if (dto.userId && currentUser.role !== Role.CLIENT) {
      const userExists = await this.prisma.user.findUnique({
        where: { id: dto.userId },
        select: { id: true },
      });

      if (!userExists) {
        throw new NotFoundException('User not found');
      }
    }

    const tour = await this.prisma.tour.findUnique({
      where: { id: dto.tourId },
      select: { id: true, available: true },
    });

    if (!tour) {
      throw new NotFoundException('Tour not found');
    }

    if (!tour.available) {
      throw new ConflictException('Tour is not available');
    }

    return this.prisma.booking.create({
      data: {
        userId,
        tourId: dto.tourId,
        partySize: dto.partySize,
        notes: sanitizeOptionalText(dto.notes),
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        paymentStatus: dto.paymentStatus,
        totalAmount: dto.totalAmount,
      },
      include: BOOKING_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateBookingDto, currentUser: RequestUser) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    this.assertAccess(booking.userId, currentUser);

    return this.prisma.booking.update({
      where: { id },
      data: {
        partySize: dto.partySize,
        notes: sanitizeOptionalText(dto.notes),
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        paymentStatus: dto.paymentStatus,
      },
      include: BOOKING_INCLUDE,
    });
  }

  async updateStatus(id: string, dto: UpdateBookingStatusDto) {
    await this.ensureExists(id);

    const booking = await this.prisma.booking.update({
      where: { id },
      data: { status: dto.status },
      include: BOOKING_INCLUDE,
    });

    this.gateway.emitStatus(booking.id, booking.status);

    return booking;
  }

  async cancel(id: string, currentUser: RequestUser) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    this.assertAccess(booking.userId, currentUser);

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
      include: BOOKING_INCLUDE,
    });

    this.gateway.emitStatus(updated.id, updated.status);

    return updated;
  }

  private assertAccess(ownerId: string, currentUser: RequestUser) {
    if (currentUser.role === Role.CLIENT && ownerId !== currentUser.sub) {
      throw new ForbiddenException('Access denied');
    }
  }

  private resolveUserId(
    requestedUserId: string | undefined,
    currentUser: RequestUser,
  ) {
    if (currentUser.role === Role.CLIENT) {
      return currentUser.sub;
    }

    return requestedUserId ?? currentUser.sub;
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.booking.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Booking not found');
    }
  }
}
