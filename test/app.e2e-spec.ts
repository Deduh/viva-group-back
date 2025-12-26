import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { App } from 'supertest/types';

const BASE64_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+Edz38QAAAABJRU5ErkJggg==';

describe('API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let pool: Pool;
  let server: App;
  let adminToken: string;
  let clientToken: string;
  let tourId: string;
  let bookingId: string;

  const adminEmail = `admin-${randomUUID()}@example.com`;
  const clientEmail = `client-${randomUUID()}@example.com`;
  const adminPassword = 'Admin123!';
  const clientPassword = 'Client123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer() as unknown as App;

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for tests');
    }
    pool = new Pool({ connectionString });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 10),
        role: Role.ADMIN,
        status: UserStatus.active,
      },
    });
    await prisma.user.create({
      data: {
        email: clientEmail,
        passwordHash: await bcrypt.hash(clientPassword, 10),
        role: Role.CLIENT,
        status: UserStatus.active,
      },
    });

    const adminLogin = await request(server)
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);
    const adminBody = adminLogin.body as { tokens: { accessToken: string } };
    adminToken = adminBody.tokens.accessToken;

    const clientLogin = await request(server)
      .post('/auth/login')
      .send({ email: clientEmail, password: clientPassword })
      .expect(200);
    const clientBody = clientLogin.body as { tokens: { accessToken: string } };
    clientToken = clientBody.tokens.accessToken;
  });

  afterAll(async () => {
    if (bookingId) {
      await prisma.message.deleteMany({ where: { bookingId } });
      await prisma.booking.deleteMany({ where: { id: bookingId } });
    }
    if (tourId) {
      await prisma.tour.deleteMany({ where: { id: tourId } });
    }
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, clientEmail] } },
    });
    await prisma.$disconnect();
    await pool.end();
    await app.close();
  });

  it('creates a tour as admin and lists tours', async () => {
    const tourResponse = await request(server)
      .post('/api/tours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        destination: 'Test Destination',
        shortDescription: 'Short description',
        fullDescription: 'Full description',
        properties: ['Guide'],
        price: 120,
        image: 'https://example.com/image.jpg',
        tags: ['test'],
        rating: 4.2,
        duration: 2,
        maxPartySize: 8,
        minPartySize: 1,
        available: true,
      })
      .expect(201);

    const tourBody = tourResponse.body as { id: string };
    tourId = tourBody.id;

    const listResponse = await request(server).get('/api/tours').expect(200);
    const listBody = listResponse.body as { items: unknown[] };
    expect(Array.isArray(listBody.items)).toBe(true);
  });

  it('creates a booking as client and updates status', async () => {
    const bookingResponse = await request(server)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        tourId,
        partySize: 2,
        notes: 'Test booking',
      })
      .expect(201);

    const bookingBody = bookingResponse.body as { id: string };
    bookingId = bookingBody.id;

    await request(server)
      .patch(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONFIRMED' })
      .expect(200);
  });

  it('lists managers as admin', async () => {
    const response = await request(server)
      .get('/api/admin/managers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const responseBody = response.body as { items: unknown[] };
    expect(Array.isArray(responseBody.items)).toBe(true);
  });

  it('uploads a tour image', async () => {
    const filePath = join(tmpdir(), `upload-${randomUUID()}.png`);
    writeFileSync(filePath, Buffer.from(BASE64_PNG, 'base64'));

    const response = await request(server)
      .post('/api/uploads/tours')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', filePath)
      .expect(201);

    const uploadBody = response.body as { url: string };
    expect(typeof uploadBody.url).toBe('string');
  });
});
