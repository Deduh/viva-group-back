import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ContactsModule } from '../contacts/contacts.module';
import { MailingModule } from '../mailing/mailing.module';
import { QueuesModule } from '../queues/queues.module';
import { TelegramSessionService } from './telegram-session.service';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramWorker } from './telegram.worker';

const QUEUES_ENABLED =
  process.env.NODE_ENV !== 'test' && process.env.DISABLE_QUEUES !== 'true';

@Module({
  imports: [ConfigModule, QueuesModule, ContactsModule, MailingModule],
  controllers: [TelegramController],
  providers: [
    TelegramService,
    TelegramSessionService,
    ...(QUEUES_ENABLED ? [TelegramWorker] : []),
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
