import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MailingCampaignStatus,
  MailingLogStatus,
  MailingSubscriberStatus,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { resolvePagination } from '../common/utils/pagination';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignListQueryDto } from './dto/campaign-list-query.dto';
import { SubscribeDto } from './dto/subscribe.dto';

type TelegramCampaignPayload = {
  subject: string;
  content: string;
  chatId: string;
};

@Injectable()
export class MailingService {
  private readonly logger = new Logger(MailingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    @InjectQueue('mailing') private readonly mailingQueue: Queue,
  ) {}

  async subscribe(dto: SubscribeDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.mailingSubscriber.findUnique({
      where: { email },
    });

    if (existing?.status === MailingSubscriberStatus.active) {
      return { ok: true };
    }

    const autoConfirm =
      this.configService.get<string>('MAILING_AUTO_CONFIRM', 'false') ===
      'true';
    const confirmToken = this.generateToken();
    const unsubToken = this.generateToken();
    const nextStatus = autoConfirm
      ? MailingSubscriberStatus.active
      : MailingSubscriberStatus.pending;
    const confirmedAt = autoConfirm ? new Date() : null;

    const subscriber = await this.prisma.mailingSubscriber.upsert({
      where: { email },
      update: {
        status: nextStatus,
        confirmToken,
        unsubToken,
        confirmedAt,
      },
      create: {
        email,
        status: nextStatus,
        confirmToken,
        unsubToken,
        confirmedAt,
      },
    });

    if (!autoConfirm) {
      await this.sendConfirmEmail(subscriber.email, confirmToken, unsubToken);
    }

    return { ok: true };
  }

  async confirm(token: string) {
    const subscriber = await this.prisma.mailingSubscriber.findUnique({
      where: { confirmToken: token },
    });

    if (!subscriber) {
      throw new NotFoundException('Invalid confirmation token');
    }

    await this.prisma.mailingSubscriber.update({
      where: { id: subscriber.id },
      data: {
        status: MailingSubscriberStatus.active,
        confirmedAt: new Date(),
      },
    });

    return { ok: true };
  }

  async unsubscribe(token: string) {
    const subscriber = await this.prisma.mailingSubscriber.findUnique({
      where: { unsubToken: token },
    });

    if (!subscriber) {
      throw new NotFoundException('Invalid unsubscribe token');
    }

    await this.prisma.mailingSubscriber.update({
      where: { id: subscriber.id },
      data: { status: MailingSubscriberStatus.unsubscribed },
    });

    return { ok: true };
  }

  async createCampaignFromTelegram(payload: TelegramCampaignPayload) {
    const campaign = await this.prisma.mailingCampaign.create({
      data: {
        subject: payload.subject,
        content: payload.content,
        status: MailingCampaignStatus.sending,
      },
    });

    await this.mailingQueue.add('send-campaign', {
      campaignId: campaign.id,
      chatId: payload.chatId,
    });

    return campaign;
  }

  async processCampaign(campaignId: string) {
    const campaign = await this.prisma.mailingCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      this.logger.warn(`Campaign ${campaignId} not found`);
      return { sent: 0, failed: 0 };
    }

    await this.prisma.mailingCampaign.update({
      where: { id: campaignId },
      data: { status: MailingCampaignStatus.sending },
    });

    const batchSize = 100;
    let cursor: { id: string } | undefined;
    let sent = 0;
    let failed = 0;

    while (true) {
      const batch = await this.prisma.mailingSubscriber.findMany({
        where: { status: MailingSubscriberStatus.active },
        orderBy: { id: 'asc' },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor } : {}),
      });

      if (batch.length === 0) {
        break;
      }

      for (const subscriber of batch) {
        try {
          await this.mailService.sendMail({
            to: subscriber.email,
            subject: campaign.subject,
            html: this.wrapHtml(campaign.content, subscriber.unsubToken),
            text: this.wrapText(campaign.content, subscriber.unsubToken),
          });
          sent += 1;
          await this.prisma.mailingLog.create({
            data: {
              campaignId: campaign.id,
              subscriberId: subscriber.id,
              email: subscriber.email,
              status: MailingLogStatus.sent,
            },
          });
        } catch (error) {
          failed += 1;
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          await this.prisma.mailingLog.create({
            data: {
              campaignId: campaign.id,
              subscriberId: subscriber.id,
              email: subscriber.email,
              status: MailingLogStatus.failed,
              error: message,
            },
          });
        }
      }

      cursor = { id: batch[batch.length - 1].id };
    }

    await this.prisma.mailingCampaign.update({
      where: { id: campaignId },
      data: {
        status:
          failed > 0
            ? MailingCampaignStatus.failed
            : MailingCampaignStatus.sent,
        sentAt: new Date(),
      },
    });

    return { sent, failed };
  }

  async getStats() {
    const activeSubscribers = await this.prisma.mailingSubscriber.count({
      where: { status: MailingSubscriberStatus.active },
    });

    return { activeSubscribers };
  }

  async listCampaigns(query: CampaignListQueryDto) {
    const { skip, take, page, limit } = resolvePagination({
      page: query.page,
      limit: query.limit,
    });

    const where = query.status ? { status: query.status } : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.mailingCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.mailingCampaign.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async listCampaignLogs(campaignId: string) {
    const campaign = await this.prisma.mailingCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.mailingLog.findMany({
        where: { campaignId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mailingLog.count({ where: { campaignId } }),
    ]);

    return { items, total };
  }

  private async sendConfirmEmail(
    email: string,
    confirmToken: string,
    unsubToken: string,
  ) {
    const confirmUrl = this.buildConfirmUrl(confirmToken);
    const unsubUrl = this.buildUnsubUrl(unsubToken);

    await this.mailService.sendMail({
      to: email,
      subject: 'Подтвердите подписку',
      html: `
        <p>Подтвердите подписку по ссылке:</p>
        <p><a href="${confirmUrl}">${confirmUrl}</a></p>
        <p>Если вы не подписывались, просто проигнорируйте это письмо.</p>
        <hr />
        <p>Отписаться: <a href="${unsubUrl}">${unsubUrl}</a></p>
      `,
      text: `Подтвердите подписку: ${confirmUrl}\nОтписаться: ${unsubUrl}`,
    });
  }

  private buildConfirmUrl(token: string) {
    const base = this.getPublicApiUrl();
    return `${base}/api/mailing/confirm?token=${token}`;
  }

  private buildUnsubUrl(token: string) {
    const base = this.getPublicApiUrl();
    return `${base}/api/mailing/unsubscribe?token=${token}`;
  }

  private getPublicApiUrl() {
    return this.configService.get<string>(
      'PUBLIC_API_URL',
      'http://localhost:3000',
    );
  }

  private wrapHtml(content: string, unsubToken: string) {
    const unsubUrl = this.buildUnsubUrl(unsubToken);
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <div>${content}</div>
        <hr />
        <p style="font-size: 12px; color: #777;">
          Отписаться: <a href="${unsubUrl}">${unsubUrl}</a>
        </p>
      </div>
    `;
  }

  private wrapText(content: string, unsubToken: string) {
    const unsubUrl = this.buildUnsubUrl(unsubToken);
    return `${content}\n\nОтписаться: ${unsubUrl}`;
  }

  private generateToken() {
    return randomBytes(24).toString('hex');
  }
}
