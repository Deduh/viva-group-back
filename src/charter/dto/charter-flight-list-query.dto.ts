import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CHARTER_CATEGORIES } from '../constants/charter-categories';

function toTrimmedString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

function toBool(value: unknown): unknown {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }

    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }
  }

  return value;
}

function toBoolFromQuery(value: unknown, obj: unknown, key: string): unknown {
  const raw =
    obj && typeof obj === 'object'
      ? (obj as Record<string, unknown>)[key]
      : undefined;

  return toBool(raw ?? value);
}

function toInt(value: unknown): unknown {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}

function toStringArray(value: unknown): unknown {
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

export class CharterFlightListQueryDto extends PaginationQueryDto {
  @Transform(({ value }) => toTrimmedString(value))
  @IsOptional()
  @IsString()
  from?: string;

  @Transform(({ value }) => toTrimmedString(value))
  @IsOptional()
  @IsString()
  to?: string;

  @Transform(({ value }) => toStringArray(value))
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsIn(CHARTER_CATEGORIES, { each: true })
  categories?: string[];

  @Transform(({ value, obj, key }) => toBoolFromQuery(value, obj, String(key)))
  @IsOptional()
  @IsBoolean()
  hasBusinessClass?: boolean;

  @Transform(({ value, obj, key }) => toBoolFromQuery(value, obj, String(key)))
  @IsOptional()
  @IsBoolean()
  hasComfortClass?: boolean;

  @Transform(({ value, obj, key }) => toBoolFromQuery(value, obj, String(key)))
  @IsOptional()
  @IsBoolean()
  hasSeats?: boolean;

  @Transform(({ value, obj, key }) => toBoolFromQuery(value, obj, String(key)))
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @Transform(({ value }) => toInt(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  pax?: number;
}
