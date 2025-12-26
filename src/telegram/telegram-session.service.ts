import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

type BroadcastStep = 'subject' | 'content';

export type BroadcastSession = {
  step: BroadcastStep;
  chatId: string;
  subject?: string;
};

type MemorySession = BroadcastSession & { expiresAt: number };

const DEFAULT_TTL_SECONDS = 15 * 60;
const KEY_PREFIX = 'telegram:broadcast:';

@Injectable()
export class TelegramSessionService implements OnModuleDestroy {
  private readonly redis?: Redis;
  private readonly memory = new Map<string, MemorySession>();

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl);
    }
  }

  async getSession(userId: number): Promise<BroadcastSession | null> {
    const key = this.getKey(userId);

    if (this.redis) {
      const raw = await this.redis.get(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as BroadcastSession;
    }

    const cached = this.memory.get(key);
    if (!cached) {
      return null;
    }

    if (cached.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }

    return {
      step: cached.step,
      chatId: cached.chatId,
      subject: cached.subject,
    };
  }

  async setSession(
    userId: number,
    session: BroadcastSession,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ) {
    const key = this.getKey(userId);

    if (this.redis) {
      await this.redis.set(key, JSON.stringify(session), 'EX', ttlSeconds);
      return;
    }

    this.memory.set(key, {
      ...session,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async clearSession(userId: number) {
    const key = this.getKey(userId);

    if (this.redis) {
      await this.redis.del(key);
      return;
    }

    this.memory.delete(key);
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  private getKey(userId: number) {
    return `${KEY_PREFIX}${userId}`;
  }
}
