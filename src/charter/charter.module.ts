import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { CharterBookingsController } from './charter-bookings.controller';
import { CharterBookingsService } from './charter-bookings.service';
import { CharterFlightsController } from './charter-flights.controller';
import { CharterFlightsService } from './charter-flights.service';

@Module({
  imports: [MessagesModule],
  controllers: [CharterBookingsController, CharterFlightsController],
  providers: [CharterBookingsService, CharterFlightsService],
})
export class CharterModule {}
