import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type TelegramResponse = {
  ok: boolean;
  description?: string;
};

@Injectable()
export class TelegramService {
  constructor(private readonly configService: ConfigService) {}

  async sendMessage(
    chatId: string,
    text: string,
    options?: Record<string, unknown>,
  ) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      ...options,
    });
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    return this.call('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
    });
  }

  private async call(method: string, body: Record<string, unknown>) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }

    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    const payload = (await response.json()) as TelegramResponse;
    if (!payload.ok) {
      throw new Error(payload.description ?? 'Telegram API error');
    }

    return payload;
  }
}
