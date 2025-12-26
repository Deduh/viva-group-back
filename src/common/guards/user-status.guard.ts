import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { RequestUser } from '../decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserStatusGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    const record = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { status: true },
    });

    if (!record) {
      throw new UnauthorizedException('User not found');
    }

    if (record.status === UserStatus.blocked) {
      throw new ForbiddenException('User is blocked');
    }

    return true;
  }
}
