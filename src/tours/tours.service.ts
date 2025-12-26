import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { resolvePagination } from '../common/utils/pagination';
import {
  sanitizeOptionalText,
  sanitizePlainText,
  sanitizeStringArray,
} from '../common/utils/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTourDto } from './dto/create-tour.dto';
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
        { destination: { contains: query.search, mode: 'insensitive' } },
        { shortDescription: { contains: query.search, mode: 'insensitive' } },
        { fullDescription: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.tags && query.tags.length > 0) {
      where.tags = { hasSome: query.tags };
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

    if (query.minRating !== undefined) {
      where.rating = { gte: query.minRating };
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
    const tour = await this.prisma.tour.findUnique({ where: { id } });

    if (!tour) {
      throw new NotFoundException('Tour not found');
    }

    return tour;
  }

  async create(dto: CreateTourDto) {
    return this.prisma.tour.create({
      data: {
        ...dto,
        destination: sanitizePlainText(dto.destination),
        shortDescription: sanitizePlainText(dto.shortDescription),
        fullDescription: sanitizeOptionalText(dto.fullDescription),
        properties: sanitizeStringArray(dto.properties),
        tags: sanitizeStringArray(dto.tags),
      },
    });
  }

  async update(id: string, dto: UpdateTourDto) {
    await this.ensureExists(id);

    return this.prisma.tour.update({
      where: { id },
      data: {
        destination: dto.destination
          ? sanitizePlainText(dto.destination)
          : undefined,
        shortDescription: dto.shortDescription
          ? sanitizePlainText(dto.shortDescription)
          : undefined,
        fullDescription:
          dto.fullDescription !== undefined
            ? sanitizeOptionalText(dto.fullDescription)
            : undefined,
        properties: dto.properties
          ? sanitizeStringArray(dto.properties)
          : undefined,
        tags: dto.tags ? sanitizeStringArray(dto.tags) : undefined,
        price: dto.price,
        image: dto.image,
        rating: dto.rating,
        duration: dto.duration,
        maxPartySize: dto.maxPartySize,
        minPartySize: dto.minPartySize,
        available: dto.available,
      },
    });
  }

  async remove(id: string) {
    const tour = await this.prisma.tour.findUnique({
      where: { id },
      select: { id: true, _count: { select: { bookings: true } } },
    });

    if (!tour) {
      throw new NotFoundException('Tour not found');
    }

    if (tour._count.bookings > 0) {
      throw new ConflictException('Tour has bookings and cannot be deleted');
    }

    return this.prisma.tour.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.tour.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Tour not found');
    }
  }
}
