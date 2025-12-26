import { BookingStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateGroupTransportStatusDto {
  @IsEnum(BookingStatus)
  status: BookingStatus;
}
