import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma, Role } from '@prisma/client';
import { RequestUser } from '../common/decorators/current-user.decorator';
import { resolvePagination } from '../common/utils/pagination';
import { MessagesGateway } from '../messages/messages.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { USER_SAFE_SELECT } from '../users/user-select';
import { CharterBookingListQueryDto } from './dto/charter-booking-list-query.dto';
import { CreateCharterBookingDto } from './dto/create-charter-booking.dto';
import { UpdateCharterStatusDto } from './dto/update-charter-status.dto';

const CHARTER_INCLUDE = {
  user: { select: USER_SAFE_SELECT },
  flight: {
    select: {
      id: true,
      publicId: true,
      from: true,
      to: true,
      dateFrom: true,
      dateTo: true,
      weekDays: true,
      categories: true,
      seatsTotal: true,
      isActive: true,
      hasBusinessClass: true,
      hasComfortClass: true,
    },
  },
};

@Injectable()
export class CharterBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessagesGateway,
  ) {}

  async findAll(query: CharterBookingListQueryDto, currentUser: RequestUser) {
    const { skip, take, page, limit } = resolvePagination({
      page: query.page,
      limit: query.limit,
    });

    const where: Prisma.CharterBookingWhereInput = {};

    if (currentUser.role === Role.CLIENT) {
      where.userId = currentUser.sub;
    } else if (query.userId) {
      where.userId = query.userId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { publicId: { contains: query.search, mode: 'insensitive' } },
        {
          flight: { publicId: { contains: query.search, mode: 'insensitive' } },
        },
        { flight: { from: { contains: query.search, mode: 'insensitive' } } },
        { flight: { to: { contains: query.search, mode: 'insensitive' } } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
        { user: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.charterBooking.findMany({
        where,
        include: CHARTER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.charterBooking.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string, currentUser: RequestUser) {
    const booking = await this.prisma.charterBooking.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
      include: CHARTER_INCLUDE,
    });

    if (!booking) {
      throw new NotFoundException('Charter booking not found');
    }

    this.assertAccess(booking.userId, currentUser);

    return booking;
  }

  async create(dto: CreateCharterBookingDto, currentUser: RequestUser) {
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

    const dateFrom = this.toUtcMidnight(dto.dateFrom);
    const dateTo = this.toUtcMidnight(dto.dateTo);

    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
      throw new BadRequestException('Invalid date range');
    }

    if (dateFrom.getTime() > dateTo.getTime()) {
      throw new BadRequestException('dateFrom must be <= dateTo');
    }

    const year = new Date().getFullYear();

    return this.prisma.$transaction(
      async (tx) => {
        const flight = await tx.charterFlight.findFirst({
          where: { OR: [{ id: dto.flightId }, { publicId: dto.flightId }] },
          select: {
            id: true,
            dateFrom: true,
            dateTo: true,
            isActive: true,
          },
        });

        if (!flight) {
          throw new NotFoundException('Charter flight not found');
        }

        if (!flight.isActive) {
          throw new BadRequestException('Charter flight is archived');
        }

        if (dateFrom.getTime() < flight.dateFrom.getTime()) {
          throw new BadRequestException(
            'dateFrom is before flight availability',
          );
        }

        if (dateTo.getTime() > flight.dateTo.getTime()) {
          throw new BadRequestException('dateTo is after flight availability');
        }

        const pax = dto.adults + (dto.children ?? 0);

        await this.reserveSeatsOrFail(tx, flight.id, dateFrom, dateTo, pax);

        const publicId = await this.allocatePublicId(tx, year);

        return tx.charterBooking.create({
          data: {
            publicId,
            userId,
            flightId: flight.id,
            dateFrom,
            dateTo,
            adults: dto.adults,
            children: dto.children ?? 0,
            status: BookingStatus.PENDING,
          },
          include: CHARTER_INCLUDE,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async updateStatus(id: string, dto: UpdateCharterStatusDto) {
    const resolvedId = await this.ensureExists(id);

    const booking = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.charterBooking.findUnique({
          where: { id: resolvedId },
          select: {
            id: true,
            status: true,
            flightId: true,
            dateFrom: true,
            dateTo: true,
            adults: true,
            children: true,
          },
        });

        if (!existing) {
          throw new NotFoundException('Charter booking not found');
        }

        const pax = existing.adults + (existing.children ?? 0);

        const wasCancelled = existing.status === BookingStatus.CANCELLED;
        const willBeCancelled = dto.status === BookingStatus.CANCELLED;

        if (!wasCancelled && willBeCancelled) {
          await this.releaseSeats(
            tx,
            existing.flightId,
            existing.dateFrom,
            existing.dateTo,
            pax,
          );
        } else if (wasCancelled && !willBeCancelled) {
          await this.reserveSeatsOrFail(
            tx,
            existing.flightId,
            existing.dateFrom,
            existing.dateTo,
            pax,
          );
        }

        return tx.charterBooking.update({
          where: { id: resolvedId },
          data: { status: dto.status },
          include: CHARTER_INCLUDE,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.gateway.emitCharterStatus(booking.id, booking.status);

    return booking;
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
    const exists = await this.prisma.charterBooking.findFirst({
      where: { OR: [{ id: idOrPublicId }, { publicId: idOrPublicId }] },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Charter booking not found');
    }

    return exists.id;
  }

  private async allocatePublicId(
    tx: Prisma.TransactionClient,
    year: number,
  ): Promise<string> {
    const rows = await tx.$queryRaw<{ current: number }[]>`
      INSERT INTO "CharterBookingIdCounter" ("year", "current")
      VALUES (${year}, 1)
      ON CONFLICT ("year")
      DO UPDATE SET "current" = "CharterBookingIdCounter"."current" + 1
      RETURNING "current";
    `;

    const current = rows[0]?.current ?? 1;
    const sequence = String(current).padStart(5, '0');

    return `VIVA-AVBOOK-${year}-${sequence}`;
  }

  private toUtcMidnight(value: string) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return parsed;
    }

    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
      ),
    );
  }

  private async reserveSeatsOrFail(
    tx: Prisma.TransactionClient,
    flightId: string,
    dateFrom: Date,
    dateTo: Date,
    pax: number,
  ) {
    if (pax <= 0) {
      throw new BadRequestException('pax must be > 0');
    }

    if (dateFrom.getTime() === dateTo.getTime()) {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "CharterFlightDate"
        SET "seatsLeft" = "seatsLeft" - ${pax * 2}
        WHERE "flightId" = ${flightId}
          AND "date" = ${dateFrom}
          AND "seatsLeft" >= ${pax * 2}
        RETURNING "id";
      `;

      if (rows.length === 0) {
        throw new BadRequestException('No seats available for selected dates');
      }

      return;
    }

    const rowsFrom = await tx.$queryRaw<{ id: string }[]>`
      UPDATE "CharterFlightDate"
      SET "seatsLeft" = "seatsLeft" - ${pax}
      WHERE "flightId" = ${flightId}
        AND "date" = ${dateFrom}
        AND "seatsLeft" >= ${pax}
      RETURNING "id";
    `;

    if (rowsFrom.length === 0) {
      throw new BadRequestException('No seats available for selected dates');
    }

    const rowsTo = await tx.$queryRaw<{ id: string }[]>`
      UPDATE "CharterFlightDate"
      SET "seatsLeft" = "seatsLeft" - ${pax}
      WHERE "flightId" = ${flightId}
        AND "date" = ${dateTo}
        AND "seatsLeft" >= ${pax}
      RETURNING "id";
    `;

    if (rowsTo.length === 0) {
      throw new BadRequestException('No seats available for selected dates');
    }
  }

  private async releaseSeats(
    tx: Prisma.TransactionClient,
    flightId: string,
    dateFrom: Date,
    dateTo: Date,
    pax: number,
  ) {
    if (pax <= 0) {
      return;
    }

    if (dateFrom.getTime() === dateTo.getTime()) {
      await tx.$executeRaw`
        UPDATE "CharterFlightDate"
        SET "seatsLeft" = LEAST("seatsTotal", "seatsLeft" + ${pax * 2})
        WHERE "flightId" = ${flightId}
          AND "date" = ${dateFrom};
      `;

      return;
    }

    await tx.$executeRaw`
      UPDATE "CharterFlightDate"
      SET "seatsLeft" = LEAST("seatsTotal", "seatsLeft" + ${pax})
      WHERE "flightId" = ${flightId}
        AND "date" = ${dateFrom};
    `;

    await tx.$executeRaw`
      UPDATE "CharterFlightDate"
      SET "seatsLeft" = LEAST("seatsTotal", "seatsLeft" + ${pax})
      WHERE "flightId" = ${flightId}
        AND "date" = ${dateTo};
    `;
  }
}
