import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { RequestUser } from '../common/decorators/current-user.decorator';
import { resolvePagination } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { USER_SAFE_SELECT } from '../users/user-select';
import { UsersService } from '../users/users.service';
import { CreateManagerDto } from './dto/create-manager.dto';
import { ManagerListQueryDto } from './dto/manager-list-query.dto';
import { UpdateManagerDto } from './dto/update-manager.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  async listManagers(query: ManagerListQueryDto) {
    const { skip, take, page, limit } = resolvePagination({
      page: query.page,
      limit: query.limit,
    });

    const { items, total } = await this.usersService.listManagers({
      search: query.search,
      status: query.status,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      skip,
      take,
    });

    return { items, total, page, limit };
  }

  async createManager(dto: CreateManagerDto, currentUser: RequestUser) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.usersService.findByEmail(email);

    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const managerRoles: Role[] = [Role.MANAGER, Role.ADMIN];
    const role = dto.role ?? Role.MANAGER;

    if (!managerRoles.includes(role)) {
      throw new BadRequestException('Invalid role for manager');
    }

    const generatedPassword = dto.password ?? this.generatePassword();
    const passwordHash = await bcrypt.hash(generatedPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: dto.name,
        phone: dto.phone,
        status: dto.status ?? UserStatus.active,
        role,
        invitedAt: new Date(),
        invitedById: currentUser.sub,
      },
      select: USER_SAFE_SELECT,
    });

    return {
      user,
      generatedPassword: dto.password ? undefined : generatedPassword,
    };
  }

  async updateManager(id: string, dto: UpdateManagerDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Manager not found');
    }

    const managerRoles: Role[] = [Role.MANAGER, Role.ADMIN];

    if (!managerRoles.includes(existing.role)) {
      throw new NotFoundException('Manager not found');
    }

    if (dto.role && !managerRoles.includes(dto.role)) {
      throw new BadRequestException('Invalid role for manager');
    }

    const data: Record<string, unknown> = {
      name: dto.name,
      phone: dto.phone,
      status: dto.status,
      role: dto.role,
    };

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: USER_SAFE_SELECT,
    });
  }

  async deleteManager(id: string, hard = false) {
    const existing = await this.prisma.user.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Manager not found');
    }

    const managerRoles: Role[] = [Role.MANAGER, Role.ADMIN];

    if (!managerRoles.includes(existing.role)) {
      throw new NotFoundException('Manager not found');
    }

    if (hard) {
      await this.prisma.user.delete({ where: { id } });

      return { success: true };
    }

    return this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.blocked },
      select: USER_SAFE_SELECT,
    });
  }

  private generatePassword() {
    return randomBytes(9).toString('base64url');
  }
}
