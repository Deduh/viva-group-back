import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SubscribeDto } from './dto/subscribe.dto';
import { TokenQueryDto } from './dto/token-query.dto';
import { MailingService } from './mailing.service';

@ApiTags('mailing')
@Controller('api/mailing')
export class MailingController {
  constructor(private readonly mailingService: MailingService) {}

  @Post('subscribe')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60 } })
  subscribe(@Body() dto: SubscribeDto) {
    return this.mailingService.subscribe(dto);
  }

  @Get('confirm')
  confirm(@Query() query: TokenQueryDto) {
    return this.mailingService.confirm(query.token);
  }

  @Post('unsubscribe')
  unsubscribe(@Query() query: TokenQueryDto) {
    return this.mailingService.unsubscribe(query.token);
  }

  @Get('unsubscribe')
  unsubscribeGet(@Query() query: TokenQueryDto) {
    return this.mailingService.unsubscribe(query.token);
  }
}
