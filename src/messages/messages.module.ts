import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GroupTransportMessagesController } from './group-transport-messages.controller';
import { MessagesController } from './messages.controller';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';

@Module({
  imports: [AuthModule],
  controllers: [MessagesController, GroupTransportMessagesController],
  providers: [MessagesService, MessagesGateway],
  exports: [MessagesGateway],
})
export class MessagesModule {}
