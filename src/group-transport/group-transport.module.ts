import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { GroupTransportController } from './group-transport.controller';
import { GroupTransportService } from './group-transport.service';

@Module({
  imports: [MessagesModule],
  controllers: [GroupTransportController],
  providers: [GroupTransportService],
})
export class GroupTransportModule {}
