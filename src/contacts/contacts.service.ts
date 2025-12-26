import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { resolvePagination } from '../common/utils/pagination';
import { sanitizePlainText } from '../common/utils/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue('telegram') private readonly telegramQueue: Queue,
  ) {}

  async create(dto: CreateContactDto) {
    const contact = await this.prisma.contactRequest.create({
      data: {
        name: sanitizePlainText(dto.name),
        email: dto.email.toLowerCase(),
        phone: dto.phone ? sanitizePlainText(dto.phone) : undefined,
        message: sanitizePlainText(dto.message),
      },
    });

    const chatId = this.configService.get<string>('TELEGRAM_CHAT_ID');
    if (chatId) {
      const text = this.formatTelegramMessage(contact);
      await this.telegramQueue.add('send-message', { chatId, text });
    } else {
      this.logger.warn('TELEGRAM_CHAT_ID is not set; skipping telegram notify');
    }

    return { ok: true };
  }

  async listAdmin(page?: number, limit?: number) {
    const {
      skip,
      take,
      page: safePage,
      limit: safeLimit,
    } = resolvePagination({ page, limit });

    const [items, total] = await this.prisma.$transaction([
      this.prisma.contactRequest.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.contactRequest.count(),
    ]);

    return { items, total, page: safePage, limit: safeLimit };
  }

  private formatTelegramMessage(contact: {
    name: string;
    email: string;
    phone: string | null;
    message: string;
  }) {
    const lines = [
      '📩 Новая заявка',
      `Имя: ${contact.name}`,
      `Email: ${contact.email}`,
      `Телефон: ${contact.phone ?? '-'}`,
      `Сообщение: ${contact.message}`,
    ];

    return lines.join('\n');
  }
}
