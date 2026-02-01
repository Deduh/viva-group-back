import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60 } })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
}
