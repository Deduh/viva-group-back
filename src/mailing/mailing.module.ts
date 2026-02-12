import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from '../mail/mail.module';
import { QueuesModule } from '../queues/queues.module';
import { MailingAdminController } from './mailing-admin.controller';
import { MailingController } from './mailing.controller';
import { MailingService } from './mailing.service';
import { MailingWorker } from './mailing.worker';

const QUEUES_ENABLED =
  process.env.NODE_ENV !== 'test' && process.env.DISABLE_QUEUES !== 'true';

@Module({
  imports: [ConfigModule, MailModule, QueuesModule],
  controllers: [MailingController, MailingAdminController],
  providers: [MailingService, ...(QUEUES_ENABLED ? [MailingWorker] : [])],
  exports: [MailingService],
})
export class MailingModule {}
