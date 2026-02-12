# Viva Group Backend (NestJS + Prisma)

Коммерческий кейс: API‑платформа для туроператора с турами, бронированиями, чатами, рассылкой и административными инструментами.

## Ключевые возможности

- Авторизация JWT (access/refresh), роли: CLIENT / MANAGER / ADMIN.
- Туры с публичным ID, фильтрацией и поиском.
- Бронирования туров и групповых перевозок.
- Бронирования чартерных рейсов.
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
- `charter`
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

## Модель чартеров (актуально)

Чартер состоит из “рейсов” (управляет менеджер) и “бронирований” (создаёт клиент).

```ts
CharterFlight {
  id: string                // UUID
  publicId: string          // VIVA-AVFL-YYYY-#####
  from: string
  to: string
  dateFrom: string          // общий диапазон доступности (UTC)
  dateTo: string            // общий диапазон доступности (UTC)
  weekDays: number[]        // 1..7 (Пн..Вс)
  categories: string[]      // фильтры (задан из фиксированного справочника)
  seatsTotal: number
  isActive: boolean         // false = архив (удаления нет)
  hasBusinessClass: boolean
  hasComfortClass: boolean
  createdAt: string
}

CharterBooking {
  id: string                // UUID
  publicId: string          // VIVA-AVBOOK-YYYY-#####
  flightId: string          // UUID или VIVA-AVFL-YYYY-#####
  dateFrom: string          // выбранная дата туда (UTC)
  dateTo: string            // выбранная дата обратно (UTC)
  adults: number
  children: number
  status: BookingStatus
  createdAt: string
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

- одинаковый контракт чата для всех типов бронирований (tour / group-transport / charter)
- base paths:
- `/api/bookings/:id/messages`
- `/api/group-transport/bookings/:id/messages`
- `/api/charter/bookings/:id/messages`
- операции для любого base path:
- `GET <base>`
- `POST <base>`
- `PATCH <base>/:messageId/read`
- `PATCH <base>/read-all`

Чартер:

- рейсы (публичный каталог для клиента; только активные):
- `GET /api/charter/flights` (всегда `isActive=true`)
- `GET /api/charter/flights/:id` (UUID или publicId; только активный)

- рейсы (админка, JWT + MANAGER/ADMIN; можно смотреть архив):
- `GET /api/charter/flights/admin` (поддерживает `?isActive=true|false`)
- `GET /api/charter/flights/admin/:id` (UUID или publicId; включая архив)

- рейсы (создаёт/редактирует MANAGER/ADMIN; удалений нет, только архив):
- `POST /api/charter/flights` (MANAGER/ADMIN)
- `PATCH /api/charter/flights/:id` (MANAGER/ADMIN)
  - архивировать: `{ "isActive": false }`
  - вернуть в активные: `{ "isActive": true }`

- бронирования (JWT; создаёт CLIENT, менеджер видит все):
- `GET /api/charter/bookings`
- `GET /api/charter/bookings/:id` (UUID или publicId)
- `POST /api/charter/bookings` (создание клиентом; редактирования после создания нет)
- `PATCH /api/charter/bookings/:id/status` (MANAGER/ADMIN)

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
- `charter:join` / `charter:leave`
- `charter:message` / `charter:status`

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
- Расширение фильтров чартерных рейсов/бронирований (по датам/категориям, экспорт).
- Админ‑интерфейс управления медиа (удаление/архив).
