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
      const tour = await this.prisma.tour.findFirst({
        where: { OR: [{ id: query.tourId }, { publicId: query.tourId }] },
        select: { id: true },
      });

      if (!tour) {
        return { items: [], total: 0, page, limit };
      }

      where.tourId = tour.id;
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

    return {
      items: items.map((item) => this.withTourPublicId(item)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, currentUser: RequestUser) {
    const booking = await this.prisma.booking.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
      include: BOOKING_INCLUDE,
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    this.assertAccess(booking.userId, currentUser);

    return this.withTourPublicId(booking);
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

    const tour = await this.resolveTour(dto.tourId);
    const year = new Date().getFullYear();

    return this.prisma.$transaction(
      async (tx) => {
        const publicId = await this.allocatePublicId(tx, year);

        const booking = await tx.booking.create({
          data: {
            publicId,
            userId,
            tourId: tour.id,
            participants: this.serializeParticipants(dto.participants),
            notes: sanitizeOptionalText(dto.notes),
            paymentStatus: dto.paymentStatus,
            totalAmount: dto.totalAmount,
          },
          include: BOOKING_INCLUDE,
        });

        return this.withTourPublicId(booking);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async update(id: string, dto: UpdateBookingDto, currentUser: RequestUser) {
    const existingBooking = await this.prisma.booking.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
    });

    if (!existingBooking) {
      throw new NotFoundException('Booking not found');
    }

    this.assertAccess(existingBooking.userId, currentUser);

    const updatedBooking = await this.prisma.booking.update({
      where: { id: existingBooking.id },
      data: {
        participants: dto.participants
          ? this.serializeParticipants(dto.participants)
          : undefined,
        notes: sanitizeOptionalText(dto.notes),
        paymentStatus: dto.paymentStatus,
      },
      include: BOOKING_INCLUDE,
    });

    return this.withTourPublicId(updatedBooking);
  }

  async updateStatus(id: string, dto: UpdateBookingStatusDto) {
    const resolvedId = await this.ensureExists(id);

    const booking = await this.prisma.booking.update({
      where: { id: resolvedId },
      data: { status: dto.status },
      include: BOOKING_INCLUDE,
    });

    this.gateway.emitStatus(booking.id, booking.status);

    return this.withTourPublicId(booking);
  }

  async cancel(id: string, currentUser: RequestUser) {
    const booking = await this.prisma.booking.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    this.assertAccess(booking.userId, currentUser);

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CANCELLED },
      include: BOOKING_INCLUDE,
    });

    this.gateway.emitStatus(updated.id, updated.status);

    return this.withTourPublicId(updated);
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

  private async ensureExists(idOrPublicId: string) {
    const exists = await this.prisma.booking.findFirst({
      where: { OR: [{ id: idOrPublicId }, { publicId: idOrPublicId }] },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Booking not found');
    }

    return exists.id;
  }

  private serializeParticipants(
    participants: CreateBookingDto['participants'],
  ): Prisma.JsonArray {
    return participants.map((participant) => ({
      fullName: participant.fullName,
      birthDate: participant.birthDate,
      gender: participant.gender,
      passportNumber: participant.passportNumber,
    }));
  }

  private async resolveTour(tourIdOrPublicId: string) {
    const tour = await this.prisma.tour.findFirst({
      where: { OR: [{ id: tourIdOrPublicId }, { publicId: tourIdOrPublicId }] },
      select: { id: true, available: true },
    });

    if (!tour) {
      throw new NotFoundException('Tour not found');
    }

    if (!tour.available) {
      throw new ConflictException('Tour is not available');
    }

    return tour;
  }

  private async allocatePublicId(
    tx: Prisma.TransactionClient,
    year: number,
  ): Promise<string> {
    const rows = await tx.$queryRaw<{ current: number }[]>`
      INSERT INTO "BookingIdCounter" ("year", "current")
      VALUES (${year}, 1)
      ON CONFLICT ("year")
      DO UPDATE SET "current" = "BookingIdCounter"."current" + 1
      RETURNING "current";
    `;

    const current = rows[0]?.current ?? 1;
    const sequence = String(current).padStart(5, '0');

    return `VIVA-BOOK-${year}-${sequence}`;
  }

  private withTourPublicId<T extends { tour?: { publicId?: string | null } }>(
    booking: T,
  ) {
    return {
      ...booking,
      tourPublicId: booking.tour?.publicId ?? null,
    };
  }
}
