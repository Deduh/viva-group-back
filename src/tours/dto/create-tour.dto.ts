import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { parseStringArray } from '../../common/utils/transform';

export class CreateTourDto {
  @IsString()
  destination: string;

  @IsString()
  shortDescription: string;

  @IsOptional()
  @IsString()
  fullDescription?: string;

  @IsArray()
  @ArrayNotEmpty()
  @Transform(({ value }) => parseStringArray(value))
  @IsString({ each: true })
  properties: string[];

  @IsNumber()
  @Min(0)
  price: number;

  @IsUrl()
  image: string;

  @IsArray()
  @Transform(({ value }) => parseStringArray(value))
  @IsString({ each: true })
  tags: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  rating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPartySize?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minPartySize?: number;

  @IsOptional()
  @IsBoolean()
  available?: boolean;
}
