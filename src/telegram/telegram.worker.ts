import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { TelegramService } from './telegram.service';

type TelegramJobData = {
  chatId: string;
  text: string;
};

@Processor('telegram')
export class TelegramWorker extends WorkerHost {
  constructor(private readonly telegramService: TelegramService) {
    super();
  }

  async process(job: Job<TelegramJobData>) {
    if (job.name !== 'send-message') {
      return;
    }

    const { chatId, text } = job.data;
    await this.telegramService.sendMessage(chatId, text);
  }
}
