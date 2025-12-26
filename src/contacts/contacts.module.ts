import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ContactsAdminController } from './contacts-admin.controller';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [ConfigModule, QueuesModule],
  controllers: [ContactsController, ContactsAdminController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
