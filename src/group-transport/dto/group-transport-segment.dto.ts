import { TransportDirection } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsString, Min } from 'class-validator';

export class GroupTransportSegmentDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEnum(TransportDirection)
  direction: TransportDirection;

  @IsDateString()
  departureDate: string;

  @IsString()
  flightNumber: string;

  @IsString()
  from: string;

  @IsString()
  to: string;

  @IsInt()
  @Min(0)
  seniorsEco: number;

  @IsInt()
  @Min(0)
  adultsEco: number;

  @IsInt()
  @Min(0)
  youthEco: number;

  @IsInt()
  @Min(0)
  childrenEco: number;

  @IsInt()
  @Min(0)
  infantsEco: number;

  @IsInt()
  @Min(0)
  seniorsBusiness: number;

  @IsInt()
  @Min(0)
  adultsBusiness: number;

  @IsInt()
  @Min(0)
  youthBusiness: number;

  @IsInt()
  @Min(0)
  childrenBusiness: number;

  @IsInt()
  @Min(0)
  infantsBusiness: number;
}
