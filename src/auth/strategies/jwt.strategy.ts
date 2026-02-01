import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Role, UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const accessSecret = configService.get<string>('JWT_ACCESS_SECRET');

    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const record = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true },
    });

    if (!record) {
      throw new UnauthorizedException('User not found');
    }

    if (record.status === UserStatus.blocked) {
      throw new ForbiddenException('User is blocked');
    }

    return payload;
  }
}
