import { IsString, MinLength } from 'class-validator';

export class TokenQueryDto {
  @IsString()
  @MinLength(10)
  token: string;
}
