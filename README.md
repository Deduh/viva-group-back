# Viva Group Backend (NestJS + Prisma)

Коммерческий кейс: API‑платформа для туроператора с турами, бронированиями, чатами, рассылкой и административными инструментами.

## Ключевые возможности

- Авторизация JWT (access/refresh), роли: CLIENT / MANAGER / ADMIN.
- Туры с публичным ID, фильтрацией и поиском.
- Бронирования туров и групповых перевозок.
- Чаты по бронированиям + WebSocket (Socket.IO).
- Заявки “Напишите нам” и email‑рассылка.
- Интеграция Telegram (webhook + админские действия).
- Загрузка изображений туров.
- E2E тесты основных потоков.

## Технологии

- NestJS 11, TypeScript
- PostgreSQL + Prisma
- JWT Auth + refresh tokens
- Socket.IO
- Redis (очереди)
- Multer (uploads)
- Swagger `/docs`

## Архитектура (модули)

- `auth`, `users`
- `tours`
- `bookings`
- `group-transport`
- `messages` (HTTP + WS)
- `contacts`
- `mailing`
- `telegram`
- `uploads`
- `admin`

## Модель тура (актуально)

```ts
Tour {
  id: string               // UUID
  publicId: string         // VIVA-TOUR-YYYY-#####
  title: string
  shortDescription: string
  image: string
  price: number
  dateFrom: string
  dateTo: string
  durationDays: number
  durationNights: number
  fullDescriptionBlocks: { title: string; items: string[] }[]
  categories: string[]     // фильтрация
  tags: string[]           // визуальные теги
  available: boolean
}
```

## API (коротко)

Swagger: `GET /docs`

Туры:
- `GET /api/tours`
- `GET /api/tours/:id` (UUID или publicId)
- `POST /api/tours` (MANAGER/ADMIN)
- `PATCH /api/tours/:id` (MANAGER/ADMIN)
- `DELETE /api/tours/:id` (ADMIN)

Бронирования:
- `GET /api/bookings`
- `GET /api/bookings/:id` (UUID или publicId)
- `POST /api/bookings`
- `PATCH /api/bookings/:id/status`
- `PATCH /api/bookings/:id`
- `POST /api/bookings/:id/cancel`

Групповые перевозки:
- `GET /api/group-transport/bookings`
- `GET /api/group-transport/bookings/:id`
- `POST /api/group-transport/bookings`
- `PATCH /api/group-transport/bookings/:id/status`
- `PATCH /api/group-transport/bookings/:id`

Сообщения:
- `GET /api/bookings/:id/messages`
- `POST /api/bookings/:id/messages`
- `PATCH /api/bookings/:id/messages/:messageId/read`
- `PATCH /api/bookings/:id/messages/read-all`

Админ:
- `GET /api/admin/managers`
- `POST /api/admin/managers`
- `PATCH /api/admin/managers/:id`
- `DELETE /api/admin/managers/:id`

Заявки и рассылка:
- `POST /api/contacts`
- `POST /api/mailing/subscribe`
- `GET /api/mailing/confirm`
- `POST /api/mailing/unsubscribe`

Uploads:
- `POST /api/uploads/tours`

## WebSocket

Namespace: `/ws`

События:
- `booking:join` / `booking:leave`
- `booking:message` / `booking:status`
- `group-transport:join` / `group-transport:leave`
- `group-transport:message` / `group-transport:status`

JWT обязателен (передаётся в `auth.token`).

## Конфигурация (ENV)

Используй `.env` или `.env.production.example` как шаблон:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`
- `PUBLIC_API_URL`, `PUBLIC_UPLOADS_URL`
- `CORS_ORIGINS`
- `REDIS_URL`
- `TELEGRAM_*`
- `SMTP_*`

Важно: в `NODE_ENV=production` приложение не стартует без `JWT_*` и `CORS_ORIGINS`.

## Запуск локально

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run seed
npm run start:dev
```

Swagger: `http://localhost:3000/docs`

## Тесты

```bash
npm run test:e2e
```

## Deployment (кратко)

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
sudo systemctl restart viva-back
```

## Roadmap / TODO

- Ограничения по размеру `fullDescriptionBlocks` (лимиты блоков/строк).
- CAPTCHA для `contacts` и `mailing` (anti‑spam).
- Уточнение метрик/логирования (structured logs).
- Расширение фильтров туров (даты, категории, price range).
- Админ‑интерфейс управления медиа (удаление/архив).
