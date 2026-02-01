import { UnprocessableEntityException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { formatValidationErrors } from './common/utils/validation';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) =>
        new UnprocessableEntityException({
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: formatValidationErrors(errors),
        }),
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  if (nodeEnv === 'production') {
    const required = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
    const missing = required.filter((key) => !configService.get<string>(key));

    if (missing.length > 0) {
      throw new Error(`Missing required env: ${missing.join(', ')}`);
    }
  }

  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (nodeEnv === 'production' && corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS is required in production');
  }

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  if (configService.get<string>('TRUST_PROXY', 'false') === 'true') {
    app.set('trust proxy', 1);
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Viva Group API')
    .setDescription('API for tours, bookings, and group transport')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
