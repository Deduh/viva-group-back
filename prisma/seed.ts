import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

type CharterProgram = {
  id: string;
  title: string;
  route: string;
  dateHint: string;
  duration: string;
  summary: string;
  priceFrom: number;
  highlights: string[];
  sections: { title: string; items: string[] }[];
  image: string;
};

async function clearTours() {
  const existingTours = await prisma.tour.findMany({
    select: { id: true },
  });
  if (existingTours.length === 0) {
    return;
  }

  const tourIds = existingTours.map((tour) => tour.id);
  const bookings = await prisma.booking.findMany({
    where: { tourId: { in: tourIds } },
    select: { id: true },
  });
  const bookingIds = bookings.map((booking) => booking.id);

  if (bookingIds.length > 0) {
    await prisma.message.deleteMany({
      where: { bookingId: { in: bookingIds } },
    });
    await prisma.bookingReadState.deleteMany({
      where: { bookingId: { in: bookingIds } },
    });
    await prisma.booking.deleteMany({
      where: { id: { in: bookingIds } },
    });
  }

  await prisma.tour.deleteMany({
    where: { id: { in: tourIds } },
  });
}

function loadCharterPrograms(): CharterProgram[] {
  const filePath = path.resolve(process.cwd(), 'TOURS.md');
  if (!fs.existsSync(filePath)) {
    throw new Error('TOURS.md not found');
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const stripped = raw
    .replace(/export\s+const\s+baseCharterPrograms:[^=]+=/, '')
    .trim();
  const source = stripped.endsWith(';') ? stripped.slice(0, -1) : stripped;

  const context: { data?: unknown } = {};
  const script = new vm.Script(`data = ${source}`);
  script.runInNewContext(context, { timeout: 1000 });

  if (!Array.isArray(context.data)) {
    throw new Error('Invalid TOURS.md format');
  }

  return context.data as CharterProgram[];
}

function parseDurationDays(duration: string): number | undefined {
  const match = duration.match(/\d+/);
  if (!match) {
    return undefined;
  }
  return Number(match[0]);
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function buildFullDescription(program: CharterProgram): string {
  const sections = program.sections
    .map((section) => {
      const items = section.items.map((item) => `- ${item}`).join('\n');
      return `${section.title}\n${items}`;
    })
    .join('\n\n');

  return [program.summary, sections].filter(Boolean).join('\n\n');
}

function buildTags(program: CharterProgram): string[] {
  const routeTags = program.route
    .split('·')
    .map((item) => item.trim())
    .filter(Boolean);

  const titleTags: string[] = [];
  if (program.title.toLowerCase().includes('новый год')) {
    titleTags.push('Новый год');
  }
  if (program.title.toLowerCase().includes('санаторий')) {
    titleTags.push('Санаторий');
  }

  return uniqueStrings([...routeTags, ...titleTags]);
}

function buildRating(program: CharterProgram): number {
  let rating = 4.4 + Math.min(program.highlights.length, 3) * 0.2;
  if (program.priceFrom >= 120000) {
    rating += 0.1;
  }
  return Number(Math.min(5, rating).toFixed(1));
}

async function main() {
  await clearTours();

  const programs = loadCharterPrograms();
  await Promise.all(
    programs.map((program) =>
      prisma.tour.create({
        data: {
          destination: program.title,
          shortDescription: program.summary,
          fullDescription: buildFullDescription(program),
          properties: uniqueStrings([
            program.dateHint,
            program.duration,
            ...program.highlights,
          ]),
          price: program.priceFrom,
          image: program.image,
          tags: buildTags(program),
          rating: buildRating(program),
          duration: parseDurationDays(program.duration),
          available: true,
        },
      }),
    ),
  );

  console.log('Seeded tours');
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
