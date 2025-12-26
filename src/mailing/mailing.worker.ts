import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { MailingService } from './mailing.service';

type MailingJobData = {
  campaignId: string;
  chatId?: string;
};

@Processor('mailing')
export class MailingWorker extends WorkerHost {
  constructor(
    private readonly mailingService: MailingService,
    @InjectQueue('telegram') private readonly telegramQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<MailingJobData>) {
    if (job.name !== 'send-campaign') {
      return;
    }

    const { campaignId, chatId } = job.data;
    const result = await this.mailingService.processCampaign(campaignId);

    if (chatId) {
      const text = `Рассылка завершена. Отправлено: ${result.sent}, ошибок: ${result.failed}.`;
      await this.telegramQueue.add('send-message', { chatId, text });
    }
  }
}
