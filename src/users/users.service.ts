import { Injectable } from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { USER_SAFE_SELECT } from './user-select';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findSafeById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_SAFE_SELECT,
    });
  }

  async createUser(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data, select: USER_SAFE_SELECT });
  }

  async updateUser(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: USER_SAFE_SELECT,
    });
  }

  async listManagers(options: {
    search?: string;
    status?: UserStatus;
    dateFrom?: Date;
    dateTo?: Date;
    skip: number;
    take: number;
  }) {
    const { search, status, dateFrom, dateTo, skip, take } = options;

    const where: Prisma.UserWhereInput = {
      role: { in: [Role.MANAGER, Role.ADMIN] },
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};

      if (dateFrom) {
        where.createdAt.gte = dateFrom;
      }

      if (dateTo) {
        where.createdAt.lte = dateTo;
      }
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SAFE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total };
  }
}
