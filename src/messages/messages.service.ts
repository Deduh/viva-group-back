import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { RequestUser } from '../common/decorators/current-user.decorator';
import { sanitizePlainText } from '../common/utils/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import { USER_SAFE_SELECT } from '../users/user-select';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesGateway } from './messages.gateway';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessagesGateway,
  ) {}

  async list(bookingId: string, currentUser: RequestUser) {
    await this.ensureBookingAccess(bookingId, currentUser);

    const readState = await this.prisma.bookingReadState.findUnique({
      where: {
        bookingId_userId: {
          bookingId,
          userId: currentUser.sub,
        },
      },
      select: { lastReadAt: true },
    });

    const [items, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where: { bookingId },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: USER_SAFE_SELECT } },
      }),
      this.prisma.message.count({ where: { bookingId } }),
    ]);

    const lastReadAt = readState?.lastReadAt ?? null;
    const withRead = items.map((message) => ({
      ...message,
      readByMe: lastReadAt ? message.createdAt <= lastReadAt : false,
    }));

    return { items: withRead, total, lastReadAt };
  }

  async create(
    bookingId: string,
    dto: CreateMessageDto,
    currentUser: RequestUser,
  ) {
    await this.ensureBookingAccess(bookingId, currentUser);

    const authorName = await this.getAuthorName(currentUser.sub);

    const message = await this.prisma.message.create({
      data: {
        bookingId,
        authorId: currentUser.sub,
        authorName,
        text: sanitizePlainText(dto.text),
        type: dto.type ?? undefined,
        attachments: dto.attachments as Prisma.InputJsonValue | undefined,
      },
      include: { author: { select: USER_SAFE_SELECT } },
    });

    await this.updateBookingReadState(
      bookingId,
      currentUser.sub,
      message.createdAt,
    );

    this.gateway.emitMessage(bookingId, message);

    return { ...message, readByMe: true };
  }

  async listGroupTransport(bookingId: string, currentUser: RequestUser) {
    await this.ensureGroupTransportAccess(bookingId, currentUser);

    const readState =
      await this.prisma.groupTransportBookingReadState.findUnique({
        where: {
          groupTransportBookingId_userId: {
            groupTransportBookingId: bookingId,
            userId: currentUser.sub,
          },
        },
        select: { lastReadAt: true },
      });

    const [items, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where: { groupTransportBookingId: bookingId },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: USER_SAFE_SELECT } },
      }),
      this.prisma.message.count({
        where: { groupTransportBookingId: bookingId },
      }),
    ]);

    const lastReadAt = readState?.lastReadAt ?? null;
    const withRead = items.map((message) => ({
      ...message,
      readByMe: lastReadAt ? message.createdAt <= lastReadAt : false,
    }));

    return { items: withRead, total, lastReadAt };
  }

  async createGroupTransport(
    bookingId: string,
    dto: CreateMessageDto,
    currentUser: RequestUser,
  ) {
    await this.ensureGroupTransportAccess(bookingId, currentUser);

    const authorName = await this.getAuthorName(currentUser.sub);

    const message = await this.prisma.message.create({
      data: {
        groupTransportBookingId: bookingId,
        authorId: currentUser.sub,
        authorName,
        text: sanitizePlainText(dto.text),
        type: dto.type ?? undefined,
        attachments: dto.attachments as Prisma.InputJsonValue | undefined,
      },
      include: { author: { select: USER_SAFE_SELECT } },
    });

    await this.updateGroupTransportReadState(
      bookingId,
      currentUser.sub,
      message.createdAt,
    );

    this.gateway.emitGroupTransportMessage(bookingId, message);

    return { ...message, readByMe: true };
  }

  async markRead(
    bookingId: string,
    messageId: string,
    currentUser: RequestUser,
  ) {
    await this.ensureBookingAccess(bookingId, currentUser);

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.bookingId !== bookingId) {
      throw new NotFoundException('Message not found');
    }

    await this.updateBookingReadState(
      bookingId,
      currentUser.sub,
      message.createdAt,
    );

    return this.prisma.message.update({
      where: { id: messageId },
      data: { isRead: true },
    });
  }

  async markReadGroupTransport(
    bookingId: string,
    messageId: string,
    currentUser: RequestUser,
  ) {
    await this.ensureGroupTransportAccess(bookingId, currentUser);

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.groupTransportBookingId !== bookingId) {
      throw new NotFoundException('Message not found');
    }

    await this.updateGroupTransportReadState(
      bookingId,
      currentUser.sub,
      message.createdAt,
    );

    return this.prisma.message.update({
      where: { id: messageId },
      data: { isRead: true },
    });
  }

  async markReadAll(bookingId: string, currentUser: RequestUser) {
    await this.ensureBookingAccess(bookingId, currentUser);

    await this.updateBookingReadState(bookingId, currentUser.sub, new Date());
    await this.prisma.message.updateMany({
      where: { bookingId, isRead: false },
      data: { isRead: true },
    });

    return { success: true };
  }

  async markReadAllGroupTransport(bookingId: string, currentUser: RequestUser) {
    await this.ensureGroupTransportAccess(bookingId, currentUser);

    await this.updateGroupTransportReadState(
      bookingId,
      currentUser.sub,
      new Date(),
    );
    await this.prisma.message.updateMany({
      where: { groupTransportBookingId: bookingId, isRead: false },
      data: { isRead: true },
    });

    return { success: true };
  }

  private async ensureBookingAccess(
    bookingId: string,
    currentUser: RequestUser,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (
      currentUser.role === Role.CLIENT &&
      booking.userId !== currentUser.sub
    ) {
      throw new ForbiddenException('Access denied');
    }
  }

  private async ensureGroupTransportAccess(
    bookingId: string,
    currentUser: RequestUser,
  ) {
    const booking = await this.prisma.groupTransportBooking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true },
    });

    if (!booking) {
      throw new NotFoundException('Group transport booking not found');
    }

    if (
      currentUser.role === Role.CLIENT &&
      booking.userId !== currentUser.sub
    ) {
      throw new ForbiddenException('Access denied');
    }
  }

  private async getAuthorName(userId: string) {
    const author = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    return author?.name ?? author?.email ?? undefined;
  }

  private async updateBookingReadState(
    bookingId: string,
    userId: string,
    readAt: Date,
  ) {
    const existing = await this.prisma.bookingReadState.findUnique({
      where: {
        bookingId_userId: {
          bookingId,
          userId,
        },
      },
      select: { lastReadAt: true },
    });

    if (existing && existing.lastReadAt >= readAt) {
      return;
    }

    await this.prisma.bookingReadState.upsert({
      where: {
        bookingId_userId: {
          bookingId,
          userId,
        },
      },
      update: { lastReadAt: readAt },
      create: { bookingId, userId, lastReadAt: readAt },
    });
  }

  private async updateGroupTransportReadState(
    bookingId: string,
    userId: string,
    readAt: Date,
  ) {
    const existing =
      await this.prisma.groupTransportBookingReadState.findUnique({
        where: {
          groupTransportBookingId_userId: {
            groupTransportBookingId: bookingId,
            userId,
          },
        },
        select: { lastReadAt: true },
      });

    if (existing && existing.lastReadAt >= readAt) {
      return;
    }

    await this.prisma.groupTransportBookingReadState.upsert({
      where: {
        groupTransportBookingId_userId: {
          groupTransportBookingId: bookingId,
          userId,
        },
      },
      update: { lastReadAt: readAt },
      create: {
        groupTransportBookingId: bookingId,
        userId,
        lastReadAt: readAt,
      },
    });
  }
}
