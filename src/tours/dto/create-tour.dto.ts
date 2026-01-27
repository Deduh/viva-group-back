import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
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

export class CreateTourDto {
  @IsString()
  title: string;

  @IsString()
  shortDescription: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => TourDescriptionBlockDto)
  fullDescriptionBlocks: TourDescriptionBlockDto[];

  @IsDateString()
  dateFrom: string;

  @IsDateString()
  dateTo: string;

  @IsInt()
  @Min(1)
  durationDays: number;

  @IsInt()
  @Min(1)
  durationNights: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsUrl()
  image: string;

  @IsArray()
  @ArrayNotEmpty()
  @Transform(({ value }) => parseStringArray(value))
  @IsString({ each: true })
  categories: string[];

  @IsArray()
  @Transform(({ value }) => parseStringArray(value))
  @IsString({ each: true })
  tags: string[];

  @IsOptional()
  @IsBoolean()
  available?: boolean;
}
