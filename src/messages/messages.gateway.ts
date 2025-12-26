import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { BookingStatus, Role, UserStatus } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

const BOOKING_ROOM_PREFIX = 'booking:';
const GROUP_TRANSPORT_ROOM_PREFIX = 'group-transport:';

function getBookingRoom(bookingId: string) {
  return `${BOOKING_ROOM_PREFIX}${bookingId}`;
}

function getGroupTransportRoom(bookingId: string) {
  return `${GROUP_TRANSPORT_ROOM_PREFIX}${bookingId}`;
}

function extractBookingId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const bookingId = record.bookingId;

  if (typeof bookingId !== 'string') {
    return null;
  }

  const trimmed = bookingId.trim();

  return trimmed.length > 0 ? trimmed : null;
}

type SocketData = {
  user?: JwtPayload;
};

type AuthSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>;

const WS_CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
  : [];

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: WS_CORS_ORIGINS.length > 0 ? WS_CORS_ORIGINS : true,
    credentials: true,
  },
})
export class MessagesGateway implements OnGatewayConnection {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @WebSocketServer()
  server!: Server;

  async handleConnection(client: AuthSocket) {
    const token = this.extractToken(client);

    if (!token) {
      client.disconnect(true);

      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.getAccessSecret(),
      });

      const isActive = await this.isUserActive(payload.sub);

      if (!isActive) {
        client.disconnect(true);

        return;
      }

      client.data.user = payload;
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('booking:join')
  async handleJoin(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: unknown,
  ) {
    const user = client.data.user;

    if (!user) {
      return { ok: false, error: 'Unauthorized' };
    }

    const bookingId = extractBookingId(payload);

    if (!bookingId) {
      return { ok: false, error: 'bookingId is required' };
    }

    const hasAccess = await this.canAccessBooking(bookingId, user);

    if (!hasAccess) {
      return { ok: false, error: 'Access denied' };
    }

    const room = getBookingRoom(bookingId);
    await client.join(room);

    return { ok: true, room };
  }

  @SubscribeMessage('booking:leave')
  async handleLeave(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: unknown,
  ) {
    if (!client.data.user) {
      return { ok: false, error: 'Unauthorized' };
    }

    const bookingId = extractBookingId(payload);

    if (!bookingId) {
      return { ok: false, error: 'bookingId is required' };
    }

    const room = getBookingRoom(bookingId);
    await client.leave(room);

    return { ok: true, room };
  }

  @SubscribeMessage('group-transport:join')
  async handleGroupTransportJoin(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: unknown,
  ) {
    const user = client.data.user;

    if (!user) {
      return { ok: false, error: 'Unauthorized' };
    }

    const bookingId = extractBookingId(payload);

    if (!bookingId) {
      return { ok: false, error: 'bookingId is required' };
    }

    const hasAccess = await this.canAccessGroupTransportBooking(
      bookingId,
      user,
    );

    if (!hasAccess) {
      return { ok: false, error: 'Access denied' };
    }

    const room = getGroupTransportRoom(bookingId);
    await client.join(room);

    return { ok: true, room };
  }

  @SubscribeMessage('group-transport:leave')
  async handleGroupTransportLeave(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: unknown,
  ) {
    if (!client.data.user) {
      return { ok: false, error: 'Unauthorized' };
    }

    const bookingId = extractBookingId(payload);

    if (!bookingId) {
      return { ok: false, error: 'bookingId is required' };
    }

    const room = getGroupTransportRoom(bookingId);
    await client.leave(room);

    return { ok: true, room };
  }

  emitMessage(bookingId: string, message: unknown) {
    const room = getBookingRoom(bookingId);
    this.server.to(room).emit('booking:message', message);
  }

  emitStatus(bookingId: string, status: BookingStatus) {
    const room = getBookingRoom(bookingId);
    this.server.to(room).emit('booking:status', { bookingId, status });
  }

  emitGroupTransportMessage(bookingId: string, message: unknown) {
    const room = getGroupTransportRoom(bookingId);
    this.server.to(room).emit('group-transport:message', message);
  }

  emitGroupTransportStatus(bookingId: string, status: BookingStatus) {
    const room = getGroupTransportRoom(bookingId);
    this.server.to(room).emit('group-transport:status', { bookingId, status });
  }

  private extractToken(client: AuthSocket) {
    const authToken =
      typeof client.handshake.auth === 'object' && client.handshake.auth
        ? (client.handshake.auth as { token?: unknown }).token
        : undefined;

    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const header = client.handshake.headers.authorization;

    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7).trim();
    }

    return null;
  }

  private getAccessSecret() {
    return this.configService.get<string>('JWT_ACCESS_SECRET', 'access-secret');
  }

  private async canAccessBooking(bookingId: string, user: JwtPayload) {
    const isActive = await this.isUserActive(user.sub);
    if (!isActive) {
      return false;
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { userId: true },
    });

    if (!booking) {
      return false;
    }

    if (user.role === Role.CLIENT) {
      return booking.userId === user.sub;
    }

    return true;
  }

  private async canAccessGroupTransportBooking(
    bookingId: string,
    user: JwtPayload,
  ) {
    const isActive = await this.isUserActive(user.sub);
    if (!isActive) {
      return false;
    }

    const booking = await this.prisma.groupTransportBooking.findUnique({
      where: { id: bookingId },
      select: { userId: true },
    });

    if (!booking) {
      return false;
    }

    if (user.role === Role.CLIENT) {
      return booking.userId === user.sub;
    }

    return true;
  }

  private async isUserActive(userId: string) {
    const record = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });

    return record?.status === UserStatus.active;
  }
}
