import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  RequestUser,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesService } from './messages.service';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/bookings/:bookingId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  list(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.messagesService.list(bookingId, user);
  }

  @Post()
  create(
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.messagesService.create(bookingId, dto, user);
  }

  @Patch(':messageId/read')
  markRead(
    @Param('bookingId') bookingId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.messagesService.markRead(bookingId, messageId, user);
  }

  @Patch('read-all')
  markReadAll(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.messagesService.markReadAll(bookingId, user);
  }
}
