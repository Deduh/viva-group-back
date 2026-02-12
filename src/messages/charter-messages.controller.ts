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
@Controller('api/charter/bookings/:bookingId/messages')
export class CharterMessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  list(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.messagesService.listCharter(bookingId, user);
  }

  @Post()
  create(
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.messagesService.createCharter(bookingId, dto, user);
  }

  @Patch(':messageId/read')
  markRead(
    @Param('bookingId') bookingId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.messagesService.markReadCharter(bookingId, messageId, user);
  }

  @Patch('read-all')
  markReadAll(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.messagesService.markReadAllCharter(bookingId, user);
  }
}
