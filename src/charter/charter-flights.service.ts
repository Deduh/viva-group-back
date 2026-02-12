import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { RequestUser } from '../common/decorators/current-user.decorator';
import { resolvePagination } from '../common/utils/pagination';
import { sanitizePlainText } from '../common/utils/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import { CharterFlightListQueryDto } from './dto/charter-flight-list-query.dto';
import { CreateCharterFlightDto } from './dto/create-charter-flight.dto';
import { UpdateCharterFlightDto } from './dto/update-charter-flight.dto';

const FLIGHT_SELECT = {
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
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CharterFlightSelect;

@Injectable()
export class CharterFlightsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseBoolLike(value: unknown): boolean | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;

      return undefined;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();

      if (['true', '1', 'yes'].includes(normalized)) return true;
      if (['false', '0', 'no'].includes(normalized)) return false;
    }

    return undefined;
  }

  async findAllPublic(query: CharterFlightListQueryDto) {
    return this.findAllInternal(query, { forceActiveOnly: true });
  }

  async findAllAdmin(query: CharterFlightListQueryDto) {
    return this.findAllInternal(query, { forceActiveOnly: false });
  }

  private async findAllInternal(
    query: CharterFlightListQueryDto,
    opts: { forceActiveOnly: boolean },
  ) {
    const { skip, take, page, limit } = resolvePagination({
      page: query.page,
      limit: query.limit,
    });

    const where: Prisma.CharterFlightWhereInput = {};
    const and: Prisma.CharterFlightWhereInput[] = [];

    if (opts.forceActiveOnly) {
      where.isActive = true;
    } else {
      const isActive = this.parseBoolLike(
        (query as unknown as { isActive?: unknown }).isActive,
      );
      if (typeof isActive === 'boolean') {
        where.isActive = isActive;
      }
    }

    if (query.from) {
      where.from = { contains: query.from, mode: 'insensitive' };
    }

    if (query.to) {
      where.to = { contains: query.to, mode: 'insensitive' };
    }

    if (query.categories && query.categories.length > 0) {
      where.categories = { hasEvery: query.categories };
    }

    if (typeof query.hasBusinessClass === 'boolean') {
      where.hasBusinessClass = query.hasBusinessClass;
    }

    if (typeof query.hasComfortClass === 'boolean') {
      where.hasComfortClass = query.hasComfortClass;
    }

    const pax = query.pax ?? 1;

    if (query.hasSeats) {
      if (query.dateFrom) {
        and.push({
          dates: {
            some: {
              date: this.toUtcMidnight(query.dateFrom),
              seatsLeft: { gte: pax },
            },
          },
        });
      }

      if (query.dateTo) {
        and.push({
          dates: {
            some: {
              date: this.toUtcMidnight(query.dateTo),
              seatsLeft: { gte: pax },
            },
          },
        });
      }

      if (!query.dateFrom && !query.dateTo) {
        and.push({
          dates: {
            some: {
              seatsLeft: { gte: pax },
            },
          },
        });
      }
    }

    if (and.length > 0) {
      where.AND = and;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.charterFlight.findMany({
        where,
        select: FLIGHT_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.charterFlight.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(idOrPublicId: string) {
    // Admin-capable lookup (includes archived flights).
    const flight = await this.prisma.charterFlight.findFirst({
      where: { OR: [{ id: idOrPublicId }, { publicId: idOrPublicId }] },
      select: FLIGHT_SELECT,
    });

    if (!flight) {
      throw new NotFoundException('Charter flight not found');
    }

    return flight;
  }

  async findOnePublic(idOrPublicId: string) {
    const flight = await this.prisma.charterFlight.findFirst({
      where: {
        isActive: true,
        OR: [{ id: idOrPublicId }, { publicId: idOrPublicId }],
      },
      select: FLIGHT_SELECT,
    });

    if (!flight) {
      throw new NotFoundException('Charter flight not found');
    }

    return flight;
  }

  async findOneAdmin(idOrPublicId: string) {
    return this.findOne(idOrPublicId);
  }

  async create(dto: CreateCharterFlightDto, currentUser: RequestUser) {
    if (currentUser.role !== Role.ADMIN && currentUser.role !== Role.MANAGER) {
      throw new ForbiddenException('Only admin/manager can create flights');
    }

    const dateFrom = this.toUtcMidnight(dto.dateFrom);
    const dateTo = this.toUtcMidnight(dto.dateTo);

    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
      throw new BadRequestException('Invalid date range');
    }

    if (dateFrom.getTime() > dateTo.getTime()) {
      throw new BadRequestException('dateFrom must be <= dateTo');
    }

    const weekDays = Array.from(new Set(dto.weekDays)).sort();
    const categories = Array.from(new Set(dto.categories));

    const year = new Date().getFullYear();

    return this.prisma.$transaction(
      async (tx) => {
        const publicId = await this.allocatePublicId(tx, year);

        const flight = await tx.charterFlight.create({
          data: {
            publicId,
            createdById: currentUser.sub,
            from: sanitizePlainText(dto.from),
            to: sanitizePlainText(dto.to),
            dateFrom,
            dateTo,
            weekDays,
            categories,
            seatsTotal: dto.seatsTotal,
            isActive: dto.isActive ?? true,
            hasBusinessClass: dto.hasBusinessClass ?? false,
            hasComfortClass: dto.hasComfortClass ?? false,
          },
          select: FLIGHT_SELECT,
        });

        const calendar = this.buildCalendarDates(dateFrom, dateTo, weekDays);

        if (calendar.length > 0) {
          await tx.charterFlightDate.createMany({
            data: calendar.map((date) => {
              const id = `${flight.id}:${this.formatYYYYMMDD(date)}`;

              return {
                id,
                flightId: flight.id,
                date,
                seatsTotal: dto.seatsTotal,
                seatsLeft: dto.seatsTotal,
              };
            }),
            skipDuplicates: true,
          });
        }

        return flight;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async update(idOrPublicId: string, dto: UpdateCharterFlightDto) {
    const existing = await this.prisma.charterFlight.findFirst({
      where: { OR: [{ id: idOrPublicId }, { publicId: idOrPublicId }] },
      select: {
        id: true,
        dateFrom: true,
        dateTo: true,
        weekDays: true,
        seatsTotal: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Charter flight not found');
    }

    const data: Prisma.CharterFlightUpdateInput = {};

    if (dto.from !== undefined) {
      data.from = sanitizePlainText(dto.from);
    }

    if (dto.to !== undefined) {
      data.to = sanitizePlainText(dto.to);
    }

    if (dto.dateFrom !== undefined) {
      const parsed = this.toUtcMidnight(dto.dateFrom);

      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid dateFrom');
      }

      data.dateFrom = parsed;
    }

    if (dto.dateTo !== undefined) {
      const parsed = this.toUtcMidnight(dto.dateTo);

      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid dateTo');
      }

      data.dateTo = parsed;
    }

    if (dto.weekDays !== undefined) {
      data.weekDays = Array.from(new Set(dto.weekDays)).sort();
    }

    if (dto.categories !== undefined) {
      data.categories = Array.from(new Set(dto.categories));
    }

    if (dto.seatsTotal !== undefined) {
      data.seatsTotal = dto.seatsTotal;
    }

    if (dto.hasBusinessClass !== undefined) {
      data.hasBusinessClass = dto.hasBusinessClass;
    }

    if (dto.hasComfortClass !== undefined) {
      data.hasComfortClass = dto.hasComfortClass;
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    const nextDateFrom =
      (data.dateFrom as Date | undefined) ?? existing.dateFrom;
    const nextDateTo = (data.dateTo as Date | undefined) ?? existing.dateTo;
    const nextWeekDays =
      (data.weekDays as number[] | undefined) ?? existing.weekDays;
    const nextSeatsTotal =
      (data.seatsTotal as number | undefined) ?? existing.seatsTotal;

    if (nextDateFrom.getTime() > nextDateTo.getTime()) {
      throw new BadRequestException('dateFrom must be <= dateTo');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.charterFlight.update({
          where: { id: existing.id },
          data,
          select: FLIGHT_SELECT,
        });

        const calendar = this.buildCalendarDates(
          nextDateFrom,
          nextDateTo,
          Array.from(new Set(nextWeekDays)).sort(),
        );
        const calendarKeys = new Set(
          calendar.map((d) => this.formatYYYYMMDD(d)),
        );

        const allDates = await tx.charterFlightDate.findMany({
          where: { flightId: existing.id },
          select: { id: true, date: true },
        });

        const toDelete = allDates
          .filter((row) => !calendarKeys.has(this.formatYYYYMMDD(row.date)))
          .map((row) => row.id);

        if (toDelete.length > 0) {
          await tx.charterFlightDate.deleteMany({
            where: { id: { in: toDelete } },
          });
        }

        if (nextSeatsTotal !== existing.seatsTotal) {
          await tx.$executeRaw`
            UPDATE "CharterFlightDate"
            SET
              "seatsLeft" = GREATEST(
                0,
                ${nextSeatsTotal} - ("seatsTotal" - "seatsLeft")
              ),
              "seatsTotal" = ${nextSeatsTotal}
            WHERE "flightId" = ${existing.id};
          `;
        }

        const presentKeys = new Set(
          allDates.map((row) => this.formatYYYYMMDD(row.date)),
        );
        const toCreate = calendar.filter(
          (d) => !presentKeys.has(this.formatYYYYMMDD(d)),
        );

        if (toCreate.length > 0) {
          await tx.charterFlightDate.createMany({
            data: toCreate.map((date) => ({
              id: `${existing.id}:${this.formatYYYYMMDD(date)}`,
              flightId: existing.id,
              date,
              seatsTotal: nextSeatsTotal,
              seatsLeft: nextSeatsTotal,
            })),
            skipDuplicates: true,
          });
        }

        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private buildCalendarDates(dateFrom: Date, dateTo: Date, weekDays: number[]) {
    const daySet = new Set(weekDays);

    const start = new Date(
      Date.UTC(
        dateFrom.getUTCFullYear(),
        dateFrom.getUTCMonth(),
        dateFrom.getUTCDate(),
      ),
    );
    const end = new Date(
      Date.UTC(
        dateTo.getUTCFullYear(),
        dateTo.getUTCMonth(),
        dateTo.getUTCDate(),
      ),
    );

    const out: Date[] = [];

    for (
      let d = new Date(start);
      d.getTime() <= end.getTime();
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const jsDay = d.getUTCDay();
      const day1to7 = jsDay === 0 ? 7 : jsDay;

      if (daySet.has(day1to7)) {
        out.push(new Date(d));
      }
    }

    return out;
  }

  private formatYYYYMMDD(date: Date) {
    const y = String(date.getUTCFullYear());
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');

    return `${y}${m}${d}`;
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

  private async allocatePublicId(
    tx: Prisma.TransactionClient,
    year: number,
  ): Promise<string> {
    const rows = await tx.$queryRaw<{ current: number }[]>`
      INSERT INTO "CharterFlightIdCounter" ("year", "current")
      VALUES (${year}, 1)
      ON CONFLICT ("year")
      DO UPDATE SET "current" = "CharterFlightIdCounter"."current" + 1
      RETURNING "current";
    `;

    const current = rows[0]?.current ?? 1;
    const sequence = String(current).padStart(5, '0');

    return `VIVA-AVFL-${year}-${sequence}`;
  }
}
