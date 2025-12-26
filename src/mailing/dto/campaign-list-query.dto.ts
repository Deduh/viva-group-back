import { IsEnum, IsOptional } from 'class-validator';
import { MailingCampaignStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CampaignListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(MailingCampaignStatus)
  status?: MailingCampaignStatus;
}
