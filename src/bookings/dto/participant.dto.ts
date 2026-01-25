import { IsDateString, IsEnum, IsString, MinLength } from 'class-validator';

export enum ParticipantGender {
  MALE = 'male',
  FEMALE = 'female',
}

export class ParticipantDto {
  @IsString()
  @MinLength(2)
  fullName: string;

  @IsDateString()
  birthDate: string;

  @IsEnum(ParticipantGender)
  gender: ParticipantGender;

  @IsString()
  @MinLength(3)
  passportNumber: string;
}
