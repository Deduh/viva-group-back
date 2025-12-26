import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { ContactsService } from '../contacts/contacts.service';
import { MailingService } from '../mailing/mailing.service';
import {
  BroadcastSession,
  TelegramSessionService,
} from './telegram-session.service';
import { TelegramService } from './telegram.service';

type TelegramMessage = {
  text?: string;
  chat?: { id?: number };
  from?: { id?: number };
};

type TelegramCallbackQuery = {
  id?: string;
  data?: string;
  from?: { id?: number };
  message?: { chat?: { id?: number } };
};

@ApiTags('telegram')
@Controller('telegram')
export class TelegramController {
  private readonly maxSubjectLength = 200;
  private readonly maxContentLength = 5000;

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramService: TelegramService,
    private readonly contactsService: ContactsService,
    private readonly mailingService: MailingService,
    private readonly sessionService: TelegramSessionService,
  ) {}

  @Post('webhook')
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') botSecret?: string,
    @Headers('x-telegram-secret-token') legacySecret?: string,
    @Body() body?: unknown,
  ) {
    this.verifySecret(botSecret ?? legacySecret);

    const callback = this.extractCallbackQuery(body);
    if (callback) {
      await this.handleCallback(callback);
      return { ok: true };
    }

    const message = this.extractMessage(body);
    if (!message?.text) {
      return { ok: true };
    }

    const chatId = this.extractChatId(message);
    const fromId = this.requireAdminId(this.extractFromId(message));

    const text = message.text.trim();

    if (text.startsWith('/cancel')) {
      await this.sessionService.clearSession(fromId);
      await this.telegramService.sendMessage(
        chatId,
        'Действие отменено.',
        this.getAdminMenuMarkup(),
      );
      return { ok: true };
    }

    const session = await this.sessionService.getSession(fromId);
    if (session && !text.startsWith('/')) {
      await this.handleBroadcastSession(session, text, fromId);
      return { ok: true };
    }

    if (text.startsWith('/broadcast')) {
      await this.handleBroadcastCommand(text, chatId, fromId);
      return { ok: true };
    }

    if (text.startsWith('/contacts')) {
      await this.handleContacts(chatId);
      return { ok: true };
    }

    if (text.startsWith('/stats')) {
      await this.handleStats(chatId);
      return { ok: true };
    }

    if (text.startsWith('/start') || text.startsWith('/help')) {
      await this.sendAdminMenu(chatId);
      return { ok: true };
    }

    await this.telegramService.sendMessage(
      chatId,
      'Команды: /broadcast <тема> | <текст>, /contacts, /stats',
      this.getAdminMenuMarkup(),
    );

    return { ok: true };
  }

  private async handleCallback(callback: TelegramCallbackQuery) {
    const fromId = this.requireAdminId(callback.from?.id);

    const data = callback.data?.trim();
    const chatId = callback.message?.chat?.id;

    if (!chatId) {
      return;
    }

    const chatIdValue = String(chatId);

    if (data === 'contacts') {
      await this.handleContacts(chatIdValue);
    } else if (data === 'stats') {
      await this.handleStats(chatIdValue);
    } else if (data === 'broadcast') {
      await this.sessionService.setSession(fromId, {
        step: 'subject',
        chatId: chatIdValue,
      });
      await this.telegramService.sendMessage(
        chatIdValue,
        'Введите тему рассылки или /cancel для отмены.',
        this.getAdminMenuMarkup(),
      );
    }

    if (callback.id) {
      await this.telegramService.answerCallbackQuery(callback.id, 'Готово');
    }
  }

  private async handleBroadcastCommand(
    text: string,
    chatId: string,
    fromId: number,
  ) {
    const payload = text.replace('/broadcast', '').trim();
    if (!payload) {
      await this.sessionService.setSession(fromId, {
        step: 'subject',
        chatId,
      });
      await this.telegramService.sendMessage(
        chatId,
        'Введите тему рассылки или /cancel для отмены.',
        this.getAdminMenuMarkup(),
      );
      return;
    }

    const [subject, content] = payload.split('|').map((part) => part.trim());

    if (!subject || !content) {
      await this.telegramService.sendMessage(
        chatId,
        'Формат: /broadcast Тема | Текст',
        this.getAdminMenuMarkup(),
      );
      return;
    }

    if (!this.validateBroadcastInput(subject, content)) {
      await this.telegramService.sendMessage(
        chatId,
        `Ограничения: тема до ${this.maxSubjectLength} символов, текст до ${this.maxContentLength} символов.`,
        this.getAdminMenuMarkup(),
      );
      return;
    }

    await this.mailingService.createCampaignFromTelegram({
      subject,
      content,
      chatId,
    });

    await this.telegramService.sendMessage(
      chatId,
      'Рассылка запущена.',
      this.getAdminMenuMarkup(),
    );
  }

  private async handleBroadcastSession(
    session: BroadcastSession,
    text: string,
    fromId: number,
  ) {
    if (session.step === 'subject') {
      const subject = text.trim();
      if (!subject || subject.length > this.maxSubjectLength) {
        await this.telegramService.sendMessage(
          session.chatId,
          `Тема должна быть от 1 до ${this.maxSubjectLength} символов.`,
          this.getAdminMenuMarkup(),
        );
        return;
      }

      await this.sessionService.setSession(fromId, {
        ...session,
        step: 'content',
        subject,
      });

      await this.telegramService.sendMessage(
        session.chatId,
        'Введите текст рассылки или /cancel для отмены.',
        this.getAdminMenuMarkup(),
      );
      return;
    }

    const content = text.trim();
    if (!content || content.length > this.maxContentLength) {
      await this.telegramService.sendMessage(
        session.chatId,
        `Текст должен быть от 1 до ${this.maxContentLength} символов.`,
        this.getAdminMenuMarkup(),
      );
      return;
    }

    const subject = session.subject ?? '';
    if (!this.validateBroadcastInput(subject, content)) {
      await this.telegramService.sendMessage(
        session.chatId,
        `Ограничения: тема до ${this.maxSubjectLength} символов, текст до ${this.maxContentLength} символов.`,
        this.getAdminMenuMarkup(),
      );
      return;
    }

    await this.mailingService.createCampaignFromTelegram({
      subject,
      content,
      chatId: session.chatId,
    });

    await this.sessionService.clearSession(fromId);

    await this.telegramService.sendMessage(
      session.chatId,
      'Рассылка запущена.',
      this.getAdminMenuMarkup(),
    );
  }

  private async handleContacts(chatId: string) {
    const { items } = await this.contactsService.listAdmin(1, 10);

    if (items.length === 0) {
      await this.telegramService.sendMessage(
        chatId,
        'Заявок пока нет.',
        this.getAdminMenuMarkup(),
      );
      return;
    }

    const text = items
      .map(
        (item, index) =>
          `${index + 1}. ${item.name} | ${item.email} | ${
            item.phone ?? '-'
          }\n${item.message}`,
      )
      .join('\n\n');

    await this.telegramService.sendMessage(
      chatId,
      text,
      this.getAdminMenuMarkup(),
    );
  }

  private async handleStats(chatId: string) {
    const stats = await this.mailingService.getStats();
    await this.telegramService.sendMessage(
      chatId,
      `Активных подписчиков: ${stats.activeSubscribers}`,
      this.getAdminMenuMarkup(),
    );
  }

  private async sendAdminMenu(chatId: string) {
    await this.telegramService.sendMessage(
      chatId,
      'Выберите действие:',
      this.getAdminMenuMarkup(),
    );
  }

  private verifySecret(secret?: string) {
    const expected = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (!expected) {
      return;
    }

    if (!secret || secret !== expected) {
      throw new ForbiddenException('Invalid telegram secret');
    }
  }

  private requireAdminId(id?: number) {
    if (!id) {
      throw new ForbiddenException('Telegram admin only');
    }

    const admins = this.getAdminIds();
    if (!admins.includes(id)) {
      throw new ForbiddenException('Telegram admin only');
    }

    return id;
  }

  private getAdminIds() {
    const raw = this.configService.get<string>('TELEGRAM_ADMIN_IDS', '');
    return raw
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));
  }

  private extractMessage(body?: unknown): TelegramMessage | null {
    if (!body || typeof body !== 'object') {
      return null;
    }

    const record = body as Record<string, unknown>;
    const message = record.message;
    if (!message || typeof message !== 'object') {
      return null;
    }

    return message as TelegramMessage;
  }

  private extractCallbackQuery(body?: unknown): TelegramCallbackQuery | null {
    if (!body || typeof body !== 'object') {
      return null;
    }

    const record = body as Record<string, unknown>;
    const callback = record.callback_query;
    if (!callback || typeof callback !== 'object') {
      return null;
    }

    return callback as TelegramCallbackQuery;
  }

  private extractChatId(message: TelegramMessage) {
    const chatId = message.chat?.id;
    if (!chatId) {
      throw new ForbiddenException('Missing chat id');
    }
    return String(chatId);
  }

  private extractFromId(message: TelegramMessage) {
    return message.from?.id;
  }

  private getAdminMenuMarkup() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📨 Рассылка', callback_data: 'broadcast' }],
          [{ text: '📥 Заявки', callback_data: 'contacts' }],
          [{ text: '📊 Статистика', callback_data: 'stats' }],
        ],
      },
    };
  }

  private validateBroadcastInput(subject: string, content: string) {
    return (
      subject.length > 0 &&
      subject.length <= this.maxSubjectLength &&
      content.length > 0 &&
      content.length <= this.maxContentLength
    );
  }
}
