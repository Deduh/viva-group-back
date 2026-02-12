-- CreateTable
CREATE TABLE "CharterFlight" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "weekDays" INTEGER[] NOT NULL,
    "categories" TEXT[] NOT NULL,
    "seatsTotal" INTEGER NOT NULL,
    "hasBusinessClass" BOOLEAN NOT NULL DEFAULT false,
    "hasComfortClass" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharterFlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterFlightDate" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "seatsTotal" INTEGER NOT NULL,
    "seatsLeft" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharterFlightDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterFlightIdCounter" (
    "year" INTEGER NOT NULL,
    "current" INTEGER NOT NULL,

    CONSTRAINT "CharterFlightIdCounter_pkey" PRIMARY KEY ("year")
);

-- Indexes
CREATE UNIQUE INDEX "CharterFlight_publicId_key" ON "CharterFlight"("publicId");
CREATE INDEX "CharterFlight_createdById_idx" ON "CharterFlight"("createdById");
CREATE INDEX "CharterFlight_from_idx" ON "CharterFlight"("from");
CREATE INDEX "CharterFlight_to_idx" ON "CharterFlight"("to");

CREATE UNIQUE INDEX "CharterFlightDate_flightId_date_key" ON "CharterFlightDate"("flightId", "date");
CREATE INDEX "CharterFlightDate_date_idx" ON "CharterFlightDate"("date");

-- FK
ALTER TABLE "CharterFlight"
ADD CONSTRAINT "CharterFlight_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CharterFlightDate"
ADD CONSTRAINT "CharterFlightDate_flightId_fkey"
FOREIGN KEY ("flightId") REFERENCES "CharterFlight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: CharterBooking becomes a booking referencing CharterFlight
ALTER TABLE "CharterBooking" ADD COLUMN "flightId" TEXT;

-- Backfill flights for existing charter bookings (1 booking -> 1 flight)
INSERT INTO "CharterFlight" (
  "id",
  "publicId",
  "createdById",
  "from",
  "to",
  "dateFrom",
  "dateTo",
  "weekDays",
  "categories",
  "seatsTotal",
  "hasBusinessClass",
  "hasComfortClass",
  "createdAt",
  "updatedAt"
)
SELECT
  b."id" AS id,
  'VIVA-CHFL-' || EXTRACT(YEAR FROM b."createdAt")::int || '-' || LPAD(
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM b."createdAt")
      ORDER BY b."createdAt" ASC, b."id" ASC
    )::text,
    5,
    '0'
  ) AS publicId,
  b."userId" AS createdById,
  b."from" AS "from",
  b."to" AS "to",
  b."dateFrom" AS "dateFrom",
  b."dateTo" AS "dateTo",
  ARRAY[1,2,3,4,5,6,7]::int[] AS weekDays,
  COALESCE(b."categories", ARRAY[]::text[]) AS categories,
  GREATEST(1, b."adults" + COALESCE(b."children", 0)) AS seatsTotal,
  false AS "hasBusinessClass",
  false AS "hasComfortClass",
  b."createdAt" AS "createdAt",
  CURRENT_TIMESTAMP AS "updatedAt"
FROM "CharterBooking" b
ON CONFLICT ("id") DO NOTHING;

-- Set flightId = booking.id
UPDATE "CharterBooking" b
SET "flightId" = b."id"
WHERE b."flightId" IS NULL;

-- Seed counters with latest values per year
INSERT INTO "CharterFlightIdCounter" ("year", "current")
SELECT ranked.year, MAX(ranked.seq) AS current
FROM (
  SELECT
    EXTRACT(YEAR FROM "createdAt")::int AS year,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM "createdAt")
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS seq
  FROM "CharterFlight"
) AS ranked
GROUP BY ranked.year
ON CONFLICT ("year") DO UPDATE SET "current" = EXCLUDED."current";

-- Backfill calendar rows (only for existing booked dates; new flights will create full calendar in app logic)
INSERT INTO "CharterFlightDate" (
  "id",
  "flightId",
  "date",
  "seatsTotal",
  "seatsLeft",
  "createdAt",
  "updatedAt"
)
SELECT
  (b."flightId" || ':' || TO_CHAR(b."dateFrom"::date, 'YYYYMMDD')) AS id,
  b."flightId" AS "flightId",
  b."dateFrom" AS "date",
  GREATEST(1, b."adults" + COALESCE(b."children", 0)) AS "seatsTotal",
  0 AS "seatsLeft",
  b."createdAt" AS "createdAt",
  CURRENT_TIMESTAMP AS "updatedAt"
FROM "CharterBooking" b
ON CONFLICT ("flightId", "date") DO NOTHING;

INSERT INTO "CharterFlightDate" (
  "id",
  "flightId",
  "date",
  "seatsTotal",
  "seatsLeft",
  "createdAt",
  "updatedAt"
)
SELECT
  (b."flightId" || ':' || TO_CHAR(b."dateTo"::date, 'YYYYMMDD')) AS id,
  b."flightId" AS "flightId",
  b."dateTo" AS "date",
  GREATEST(1, b."adults" + COALESCE(b."children", 0)) AS "seatsTotal",
  0 AS "seatsLeft",
  b."createdAt" AS "createdAt",
  CURRENT_TIMESTAMP AS "updatedAt"
FROM "CharterBooking" b
ON CONFLICT ("flightId", "date") DO NOTHING;

-- Enforce not null + FK
ALTER TABLE "CharterBooking" ALTER COLUMN "flightId" SET NOT NULL;

ALTER TABLE "CharterBooking"
ADD CONSTRAINT "CharterBooking_flightId_fkey"
FOREIGN KEY ("flightId") REFERENCES "CharterFlight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "CharterBooking_flightId_idx" ON "CharterBooking"("flightId");

-- Drop legacy columns from CharterBooking
ALTER TABLE "CharterBooking" DROP COLUMN "from";
ALTER TABLE "CharterBooking" DROP COLUMN "to";
ALTER TABLE "CharterBooking" DROP COLUMN "categories";
