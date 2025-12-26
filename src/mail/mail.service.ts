import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

type MailPayload = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

@Injectable()
export class MailService {
  private transporter?: Transporter;
  private from?: string;

  constructor(private readonly configService: ConfigService) {}

  async sendMail(payload: MailPayload) {
    const transporter = this.getTransporter();
    await transporter.sendMail({
      from: this.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
  }

  private getTransporter() {
    if (this.transporter && this.from) {
      return this.transporter;
    }

    const transport = this.configService.get<string>('MAIL_TRANSPORT', 'smtp');
    if (transport !== 'smtp') {
      throw new Error(`MAIL_TRANSPORT "${transport}" is not supported yet`);
    }

    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT', '587'));
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host) {
      throw new Error('SMTP_HOST is not configured');
    }

    const hasAuth = Boolean(user) || Boolean(pass);
    if (hasAuth && (!user || !pass)) {
      throw new Error('SMTP_USER and SMTP_PASS must be set together');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      ...(user && pass ? { auth: { user, pass } } : {}),
    });

    this.from = this.configService.get<string>(
      'MAIL_FROM',
      user ?? 'no-reply@localhost',
    );

    return this.transporter;
  }
}
