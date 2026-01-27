import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class TourDescriptionBlockDto {
  @IsString()
  title: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  items: string[];
}
