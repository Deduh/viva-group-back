import { PrismaPg } from '@prisma/adapter-pg';
import {
  BookingStatus,
  MessageType,
  PrismaClient,
  Role,
  TransportDirection,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function clearDatabase() {
  await prisma.mailingLog.deleteMany();
  await prisma.mailingCampaign.deleteMany();
  await prisma.mailingSubscriber.deleteMany();
  await prisma.contactRequest.deleteMany();
  await prisma.groupTransportBookingReadState.deleteMany();
  await prisma.bookingReadState.deleteMany();
  await prisma.message.deleteMany();
  await prisma.groupTransportSegment.deleteMany();
  await prisma.groupTransportBooking.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.tour.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  const shouldClear =
    process.env.SEED_CLEAR === 'true' || process.argv.includes('--clear');
  if (shouldClear) {
    await clearDatabase();
  }

  const adminPassword = 'Admin123!';
  const managerPassword = 'Manager123!';
  const clientPassword = 'Client123!';

  await prisma.user.upsert({
    where: { email: 'admin@viva.local' },
    update: {},
    create: {
      email: 'admin@viva.local',
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: Role.ADMIN,
      status: UserStatus.active,
      name: 'Admin User',
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@viva.local' },
    update: {},
    create: {
      email: 'manager@viva.local',
      passwordHash: await bcrypt.hash(managerPassword, 10),
      role: Role.MANAGER,
      status: UserStatus.active,
      name: 'Manager User',
    },
  });

  const client = await prisma.user.upsert({
    where: { email: 'client@viva.local' },
    update: {},
    create: {
      email: 'client@viva.local',
      passwordHash: await bcrypt.hash(clientPassword, 10),
      role: Role.CLIENT,
      status: UserStatus.active,
      name: 'Client User',
    },
  });

  const tours = await Promise.all([
    prisma.tour.create({
      data: {
        destination: 'Istanbul',
        shortDescription: 'City highlights and Bosphorus cruise',
        fullDescription:
          'Explore the historic peninsula, bazaars, and iconic landmarks.',
        properties: ['Guide included', 'Hotel pickup'],
        price: 450,
        image: 'https://example.com/images/istanbul.jpg',
        tags: ['city', 'culture'],
        rating: 4.6,
        duration: 3,
        maxPartySize: 20,
        minPartySize: 2,
        available: true,
      },
    }),
    prisma.tour.create({
      data: {
        destination: 'Cappadocia',
        shortDescription: 'Hot air balloon adventure',
        fullDescription:
          'Sunrise balloon ride over fairy chimneys with breakfast.',
        properties: ['Balloon ride', 'Breakfast'],
        price: 900,
        image: 'https://example.com/images/cappadocia.jpg',
        tags: ['adventure', 'nature'],
        rating: 4.9,
        duration: 2,
        maxPartySize: 12,
        minPartySize: 1,
        available: true,
      },
    }),
    prisma.tour.create({
      data: {
        destination: 'Antalya',
        shortDescription: 'Beach escape',
        fullDescription: 'Relax by the Mediterranean with optional excursions.',
        properties: ['Resort stay', 'Transfers'],
        price: 600,
        image: 'https://example.com/images/antalya.jpg',
        tags: ['beach', 'relax'],
        rating: 4.4,
        duration: 5,
        maxPartySize: 10,
        minPartySize: 1,
        available: true,
      },
    }),
  ]);

  const booking = await prisma.booking.create({
    data: {
      userId: client.id,
      tourId: tours[0].id,
      status: BookingStatus.CONFIRMED,
      partySize: 2,
      notes: 'Window seats, please',
      startDate: new Date(),
      paymentStatus: 'PAID',
      totalAmount: 900,
    },
  });

  await prisma.message.createMany({
    data: [
      {
        bookingId: booking.id,
        authorId: client.id,
        authorName: client.name ?? 'Client',
        text: 'Looking forward to this trip!',
        type: MessageType.TEXT,
        isRead: true,
      },
      {
        bookingId: booking.id,
        authorId: manager.id,
        authorName: manager.name ?? 'Manager',
        text: 'We will confirm all details soon.',
        type: MessageType.TEXT,
        isRead: false,
      },
    ],
  });

  const groupBooking = await prisma.groupTransportBooking.create({
    data: {
      userId: client.id,
      status: BookingStatus.PENDING,
      note: 'Group transport request',
      segments: {
        create: [
          {
            direction: TransportDirection.forward,
            departureDate: new Date(),
            flightNumber: 'TK123',
            from: 'IST',
            to: 'AYT',
            seniorsEco: 0,
            adultsEco: 2,
            youthEco: 0,
            childrenEco: 0,
            infantsEco: 0,
            seniorsBusiness: 0,
            adultsBusiness: 0,
            youthBusiness: 0,
            childrenBusiness: 0,
            infantsBusiness: 0,
          },
        ],
      },
    },
  });

  await prisma.message.create({
    data: {
      groupTransportBookingId: groupBooking.id,
      authorId: manager.id,
      authorName: manager.name ?? 'Manager',
      text: 'We are checking availability for your group transport.',
      type: MessageType.NOTIFICATION,
      isRead: false,
    },
  });

  console.log('Seeded data');
  console.log({ adminPassword, managerPassword, clientPassword });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
