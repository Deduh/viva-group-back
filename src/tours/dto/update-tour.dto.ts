import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from 'class-validator';
import { parseStringArray } from '../../common/utils/transform';
import { TourDescriptionBlockDto } from './tour-description-block.dto';

export class UpdateTourDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TourDescriptionBlockDto)
  fullDescriptionBlocks?: TourDescriptionBlockDto[];

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationNights?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsUrl()
  image?: string;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => parseStringArray(value))
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => parseStringArray(value))
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  available?: boolean;
}
