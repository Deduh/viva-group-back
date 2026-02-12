import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import * as vm from 'vm';

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
    await prisma.tourIdCounter.deleteMany();

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

  await prisma.tourIdCounter.deleteMany();
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

function parseDurationParts(duration: string): {
  days?: number;
  nights?: number;
} {
  const daysMatch = duration.match(/(\d+)\s*д/i);
  const nightsMatch = duration.match(/(\d+)\s*н/i);

  return {
    days: daysMatch ? Number(daysMatch[1]) : undefined,
    nights: nightsMatch ? Number(nightsMatch[1]) : undefined,
  };
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

function buildDescriptionBlocks(
  program: CharterProgram,
): Prisma.InputJsonValue {
  const blocks = program.sections
    .map((section) => ({
      title: section.title.trim(),
      items: uniqueStrings(section.items),
    }))
    .filter((section) => section.title.length > 0 && section.items.length > 0);

  return blocks as Prisma.InputJsonValue;
}

function extractYear(program: CharterProgram): number {
  const candidates = [
    program.dateHint,
    ...program.sections.map((section) => section.title),
  ];

  for (const text of candidates) {
    const match = text.match(/\b(20\d{2})\b/);

    if (match) {
      return Number(match[1]);
    }
  }

  return new Date().getFullYear();
}

function parseDateRange(program: CharterProgram): {
  dateFrom?: Date;
  dateTo?: Date;
} {
  const matches = [...program.dateHint.matchAll(/(\d{1,2})\.(\d{1,2})/g)];

  if (matches.length >= 2) {
    const year = extractYear(program);
    const [startDay, startMonth] = matches[0].slice(1).map(Number);
    const [endDay, endMonth] = matches[matches.length - 1].slice(1).map(Number);

    const startYear = year;
    const endYear = endMonth < startMonth ? year + 1 : year;

    return {
      dateFrom: new Date(Date.UTC(startYear, startMonth - 1, startDay)),
      dateTo: new Date(Date.UTC(endYear, endMonth - 1, endDay)),
    };
  }

  const sectionDates = extractSectionDates(program);

  if (sectionDates.length === 0) {
    return {};
  }

  const timestamps = sectionDates.map((date) => date.getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);

  return {
    dateFrom: new Date(minTime),
    dateTo: new Date(maxTime),
  };
}

function buildCategories(program: CharterProgram): string[] {
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

function buildTags(program: CharterProgram): string[] {
  return uniqueStrings(program.highlights);
}

function extractSectionDates(program: CharterProgram): Date[] {
  const dates: Date[] = [];
  const defaultYear = extractYear(program);
  let inferredYear = defaultYear;
  let lastMonth: number | undefined;

  for (const section of program.sections) {
    const matches = [
      ...section.title.matchAll(/(\d{1,2})\.(\d{1,2})(?:\.(20\d{2}))?/g),
    ];

    for (const match of matches) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      const explicitYear = match[3] ? Number(match[3]) : undefined;

      if (explicitYear) {
        inferredYear = explicitYear;
      } else if (lastMonth !== undefined && month < lastMonth) {
        inferredYear += 1;
      }

      lastMonth = month;

      dates.push(new Date(Date.UTC(inferredYear, month - 1, day)));
    }
  }

  return dates;
}

async function main() {
  await clearTours();

  const programs = loadCharterPrograms();

  for (const program of programs) {
    const id = await generateUniqueTourId();
    const { days, nights } = parseDurationParts(program.duration);
    const { dateFrom, dateTo } = parseDateRange(program);
    await prisma.tour.create({
      data: {
        publicId: id,
        title: program.title,
        shortDescription: program.summary,
        fullDescriptionBlocks: buildDescriptionBlocks(program),
        price: program.priceFrom,
        image: program.image,
        categories: buildCategories(program),
        tags: buildTags(program),
        dateFrom,
        dateTo,
        durationDays: days,
        durationNights: nights,
        available: true,
      },
    });
  }

  console.log('Seeded tours');
}

async function generateUniqueTourId() {
  const year = new Date().getFullYear();
  const rows = await prisma.$queryRaw<{ current: number }[]>`
    INSERT INTO "TourIdCounter" ("year", "current")
    VALUES (${year}, 1)
    ON CONFLICT ("year")
    DO UPDATE SET "current" = "TourIdCounter"."current" + 1
    RETURNING "current";
  `;

  const current = rows[0]?.current ?? 1;
  const sequence = String(current).padStart(5, '0');

  return `VIVA-TOUR-${year}-${sequence}`;
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
