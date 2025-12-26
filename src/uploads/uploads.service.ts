import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class UploadsService {
  constructor(private readonly configService: ConfigService) {}

  buildTourUrl(req: Request, filename: string) {
    const baseUrl = this.configService.get<string>('PUBLIC_UPLOADS_URL');
    const origin = baseUrl ?? `${req.protocol}://${req.get('host')}`;

    return `${origin}/uploads/tours/${filename}`;
  }
}
