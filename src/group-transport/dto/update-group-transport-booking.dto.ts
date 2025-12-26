import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { GroupTransportSegmentDto } from './group-transport-segment.dto';

export class UpdateGroupTransportBookingDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupTransportSegmentDto)
  segments?: GroupTransportSegmentDto[];
}
