import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { MessageType } from '@prisma/client';

export class CreateMessageDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  @IsArray()
  attachments?: unknown[];
}
