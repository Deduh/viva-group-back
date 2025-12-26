import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';

function parseRedisUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  const dbPath = parsed.pathname?.replace('/', '');
  const db = dbPath ? Number(dbPath) : undefined;

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number.isFinite(db) ? db : undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        const connection = redisUrl
          ? parseRedisUrl(redisUrl)
          : { host: '127.0.0.1', port: 6379 };

        return { connection };
      },
    }),
    BullModule.registerQueue({ name: 'telegram' }, { name: 'mailing' }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
