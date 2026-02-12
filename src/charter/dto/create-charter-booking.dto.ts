import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

function toTrimmedString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

export class CreateCharterBookingDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @Matches(
    /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|VIVA-AVFL-\\d{4}-\\d{5})$/i,
  )
  flightId!: string;

  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;

  @IsInt()
  @Min(1)
  adults!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;
}
