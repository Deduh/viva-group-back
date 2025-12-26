import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { GroupTransportSegmentDto } from './group-transport-segment.dto';

export class CreateGroupTransportBookingDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GroupTransportSegmentDto)
  segments: GroupTransportSegmentDto[];

  @IsOptional()
  @IsString()
  note?: string;
}
