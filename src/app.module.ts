import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { CharterModule } from './charter/charter.module';
import { CommonModule } from './common/common.module';
import { ContactsModule } from './contacts/contacts.module';
import { GroupTransportModule } from './group-transport/group-transport.module';
import { MailingModule } from './mailing/mailing.module';
import { MessagesModule } from './messages/messages.module';
import { PrismaModule } from './prisma/prisma.module';
import { TelegramModule } from './telegram/telegram.module';
import { ToursModule } from './tours/tours.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'default',
          ttl: Number(configService.get<string>('RATE_LIMIT_TTL', '60')),
          limit: Number(configService.get<string>('RATE_LIMIT_LIMIT', '60')),
        },
      ],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    CommonModule,
    PrismaModule,
    UsersModule,
    AuthModule,
    ToursModule,
    BookingsModule,
    CharterModule,
    GroupTransportModule,
    MessagesModule,
    AdminModule,
    UploadsModule,
    ContactsModule,
    MailingModule,
    TelegramModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
