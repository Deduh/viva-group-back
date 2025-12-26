import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof PrismaClientKnownRequestError) {
      const payload = this.mapPrismaError(exception);
      response.status(payload.status).json(payload.body);

      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = this.mapHttpException(exception, status);
      response.status(status).json(payload);

      return;
    }

    const message =
      exception instanceof Error ? exception.message : 'Internal server error';
    this.logger.error(
      message,
      exception instanceof Error ? exception.stack : undefined,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message });
  }

  private mapHttpException(exception: HttpException, status: number) {
    const response = exception.getResponse();
    let message = exception.message;
    let details: unknown;
    let code: string | undefined;

    if (typeof response === 'string') {
      message = response;
    } else if (response && typeof response === 'object') {
      const payload = response as Record<string, unknown>;

      if (typeof payload.message === 'string') {
        message = payload.message;
      }

      if (Array.isArray(payload.message)) {
        message = 'Validation failed';
        details = payload.message;
      }

      if (payload.details !== undefined) {
        details = payload.details;
      }

      if (typeof payload.code === 'string') {
        code = payload.code;
      }
    }

    const body: Record<string, unknown> = { message };

    if (code) {
      body.code = code;
    }

    if (details !== undefined) {
      body.details = details;
    }

    if (status >= 500) {
      this.logger.error(message, exception.stack);
    }

    return body;
  }

  private mapPrismaError(exception: PrismaClientKnownRequestError) {
    if (exception.code === 'P2002') {
      return {
        status: HttpStatus.CONFLICT,
        body: {
          message: 'Unique constraint failed',
          code: exception.code,
          details: exception.meta,
        },
      };
    }

    return {
      status: HttpStatus.BAD_REQUEST,
      body: {
        message: 'Database error',
        code: exception.code,
        details: exception.meta,
      },
    };
  }
}
