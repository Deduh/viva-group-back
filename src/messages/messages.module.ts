import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CharterMessagesController } from './charter-messages.controller';
import { GroupTransportMessagesController } from './group-transport-messages.controller';
import { MessagesController } from './messages.controller';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';

@Module({
  imports: [AuthModule],
  controllers: [
    MessagesController,
    GroupTransportMessagesController,
    CharterMessagesController,
  ],
  providers: [MessagesService, MessagesGateway],
  exports: [MessagesGateway],
})
export class MessagesModule {}
