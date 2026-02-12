import { BookingStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateCharterStatusDto {
  @IsEnum(BookingStatus)
  status!: BookingStatus;
}
