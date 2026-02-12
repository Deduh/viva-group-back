import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';

const QUEUES_ENABLED =
  process.env.NODE_ENV !== 'test' && process.env.DISABLE_QUEUES !== 'true';

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
    ...(QUEUES_ENABLED
      ? [
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
        ]
      : []),
  ],
  providers: QUEUES_ENABLED
    ? []
    : [
        {
          provide: getQueueToken('telegram'),
          useValue: { add: () => Promise.resolve(null) },
        },
        {
          provide: getQueueToken('mailing'),
          useValue: { add: () => Promise.resolve(null) },
        },
      ],
  exports: QUEUES_ENABLED
    ? [BullModule]
    : [getQueueToken('telegram'), getQueueToken('mailing')],
})
export class QueuesModule {}
