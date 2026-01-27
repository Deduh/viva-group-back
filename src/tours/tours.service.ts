import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { resolvePagination } from '../common/utils/pagination';
import {
  sanitizePlainText,
  sanitizeStringArray,
} from '../common/utils/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTourDto } from './dto/create-tour.dto';
import { TourDescriptionBlockDto } from './dto/tour-description-block.dto';
import { TourListQueryDto } from './dto/tour-list-query.dto';
import { UpdateTourDto } from './dto/update-tour.dto';

@Injectable()
export class ToursService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: TourListQueryDto) {
    const { skip, take, page, limit } = resolvePagination({
      page: query.page,
      limit: query.limit,
    });

    const where: Prisma.TourWhereInput = {};

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { shortDescription: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.categories && query.categories.length > 0) {
      where.categories = { hasSome: query.categories };
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {};

      if (query.minPrice !== undefined) {
        where.price.gte = query.minPrice;
      }

      if (query.maxPrice !== undefined) {
        where.price.lte = query.maxPrice;
      }
    }

    if (query.publicId) {
      where.publicId = query.publicId;
    }

    const orderBy: Prisma.TourOrderByWithRelationInput = query.sortBy
      ? { [query.sortBy]: query.sortOrder ?? 'desc' }
      : { createdAt: 'desc' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tour.findMany({ where, orderBy, skip, take }),
      this.prisma.tour.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const tour = await this.prisma.tour.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
    });

    if (!tour) {
      throw new NotFoundException('Tour not found');
    }

    return tour;
  }

  async create(dto: CreateTourDto) {
    const year = new Date().getFullYear();

    return this.prisma.$transaction(
      async (tx) => {
        const publicId = await this.allocatePublicId(tx, year);

        return tx.tour.create({
          data: {
            publicId,
            ...dto,
            title: sanitizePlainText(dto.title),
            shortDescription: sanitizePlainText(dto.shortDescription),
            fullDescriptionBlocks: this.sanitizeDescriptionBlocks(
              dto.fullDescriptionBlocks,
            ),
            categories: sanitizeStringArray(dto.categories),
            tags: sanitizeStringArray(dto.tags),
            dateFrom: new Date(dto.dateFrom),
            dateTo: new Date(dto.dateTo),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async update(id: string, dto: UpdateTourDto) {
    const resolvedId = await this.ensureExists(id);

    return this.prisma.tour.update({
      where: { id: resolvedId },
      data: {
        title: dto.title ? sanitizePlainText(dto.title) : undefined,
        shortDescription: dto.shortDescription
          ? sanitizePlainText(dto.shortDescription)
          : undefined,
        fullDescriptionBlocks:
          dto.fullDescriptionBlocks !== undefined
            ? this.sanitizeDescriptionBlocks(dto.fullDescriptionBlocks)
            : undefined,
        categories: dto.categories
          ? sanitizeStringArray(dto.categories)
          : undefined,
        tags: dto.tags ? sanitizeStringArray(dto.tags) : undefined,
        price: dto.price,
        image: dto.image,
        dateFrom: dto.dateFrom ? new Date(dto.dateFrom) : undefined,
        dateTo: dto.dateTo ? new Date(dto.dateTo) : undefined,
        durationDays: dto.durationDays,
        durationNights: dto.durationNights,
        available: dto.available,
      },
    });
  }

  async remove(id: string) {
    const resolvedId = await this.ensureExists(id);
    const tour = await this.prisma.tour.findUnique({
      where: { id: resolvedId },
      select: { id: true, _count: { select: { bookings: true } } },
    });

    if (!tour) {
      throw new NotFoundException('Tour not found');
    }

    if (tour._count.bookings > 0) {
      throw new ConflictException('Tour has bookings and cannot be deleted');
    }

    return this.prisma.tour.delete({ where: { id: resolvedId } });
  }

  private async ensureExists(idOrPublicId: string) {
    const exists = await this.prisma.tour.findFirst({
      where: { OR: [{ id: idOrPublicId }, { publicId: idOrPublicId }] },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Tour not found');
    }

    return exists.id;
  }

  private async allocatePublicId(
    tx: Prisma.TransactionClient,
    year: number,
  ): Promise<string> {
    const rows = await tx.$queryRaw<{ current: number }[]>`
      INSERT INTO "TourIdCounter" ("year", "current")
      VALUES (${year}, 1)
      ON CONFLICT ("year")
      DO UPDATE SET "current" = "TourIdCounter"."current" + 1
      RETURNING "current";
    `;

    const current = rows[0]?.current ?? 1;
    const sequence = String(current).padStart(5, '0');

    return `VIVA-TOUR-${year}-${sequence}`;
  }

  private sanitizeDescriptionBlocks(
    blocks: TourDescriptionBlockDto[],
  ): Prisma.InputJsonValue {
    const sanitized = blocks
      .map((block) => ({
        title: sanitizePlainText(block.title),
        items: sanitizeStringArray(block.items),
      }))
      .filter((block) => block.title.length > 0 && block.items.length > 0);

    return sanitized as Prisma.InputJsonValue;
  }
}
