import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { USER_SAFE_SELECT } from '../users/user-select';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.blocked) {
      throw new ForbiddenException('User is blocked');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 10),
      },
    });

    const safeUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: USER_SAFE_SELECT,
    });

    return { user: safeUser, tokens };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.usersService.findByEmail(email);

    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: dto.name,
        phone: dto.phone,
        role: Role.CLIENT,
        status: UserStatus.active,
      },
      select: USER_SAFE_SELECT,
    });

    const tokens = await this.issueTokens(user.id, user.email, user.role);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 10),
      },
    });

    return { user, tokens };
  }

  async refresh(dto: RefreshDto) {
    const refreshSecret = this.getRefreshSecret();
    let payload: { sub: string; email: string; role: Role };

    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenMatch = await bcrypt.compare(
      dto.refreshToken,
      user.refreshTokenHash,
    );

    if (!tokenMatch) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (user.status === UserStatus.blocked) {
      throw new ForbiddenException('User is blocked');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 10),
      },
    });

    const safeUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: USER_SAFE_SELECT,
    });

    return { user: safeUser, tokens };
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: Role,
  ): Promise<AuthTokens> {
    const accessExpiresIn = this.getAccessExpiresIn();
    const refreshExpiresIn = this.getRefreshExpiresIn();
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email, role },
      {
        secret: this.getAccessSecret(),
        expiresIn: accessExpiresIn as JwtSignOptions['expiresIn'],
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, email, role },
      {
        secret: this.getRefreshSecret(),
        expiresIn: refreshExpiresIn as JwtSignOptions['expiresIn'],
      },
    );

    return { accessToken, refreshToken, accessExpiresIn, refreshExpiresIn };
  }

  private getAccessSecret() {
    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');

    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is required');
    }

    return secret;
  }

  private getRefreshSecret() {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is required');
    }

    return secret;
  }

  private getAccessExpiresIn() {
    return this.configService.get<string>('JWT_ACCESS_TTL', '15m');
  }

  private getRefreshExpiresIn() {
    return this.configService.get<string>('JWT_REFRESH_TTL', '7d');
  }
}
