import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { CHARTER_CATEGORIES } from '../constants/charter-categories';

function toTrimmedString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

function toTrimmedStringArray(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return value;
}

function toIntArray(value: unknown): unknown {
  if (Array.isArray(value)) {
    const out: number[] = [];

    for (const item of value as unknown[]) {
      if (typeof item === 'number' && Number.isFinite(item)) {
        out.push(item);
        continue;
      }

      if (typeof item === 'string') {
        const parsed = Number(item.trim());
        if (Number.isFinite(parsed)) {
          out.push(parsed);
        }
      }
    }

    return out;
  }

  if (typeof value === 'string') {
    const out: number[] = [];

    for (const piece of value.split(',')) {
      const parsed = Number(piece.trim());
      if (Number.isFinite(parsed)) {
        out.push(parsed);
      }
    }

    return out;
  }

  return value;
}

export class CreateCharterFlightDto {
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @Length(2, 100)
  from!: string;

  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @Length(2, 100)
  to!: string;

  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;

  @Transform(({ value }) => toIntArray(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekDays!: number[];

  @Transform(({ value }) => toTrimmedStringArray(value))
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsIn(CHARTER_CATEGORIES, { each: true })
  categories!: string[];

  @IsInt()
  @Min(1)
  @Max(10000)
  seatsTotal!: number;

  @IsOptional()
  @IsBoolean()
  hasBusinessClass?: boolean;

  @IsOptional()
  @IsBoolean()
  hasComfortClass?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
