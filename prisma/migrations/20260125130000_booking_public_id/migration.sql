-- CreateTable
CREATE TABLE "BookingIdCounter" (
    "year" INTEGER NOT NULL,
    "current" INTEGER NOT NULL,

    CONSTRAINT "BookingIdCounter_pkey" PRIMARY KEY ("year")
);

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "publicId" TEXT;

-- Backfill publicId for existing bookings
WITH ranked AS (
    SELECT
        "id",
        EXTRACT(YEAR FROM "createdAt")::int AS year,
        ROW_NUMBER() OVER (
            PARTITION BY EXTRACT(YEAR FROM "createdAt")
            ORDER BY "createdAt" ASC, "id" ASC
        ) AS seq
    FROM "Booking"
)
UPDATE "Booking" AS b
SET "publicId" = 'VIVA-BOOK-' || ranked.year || '-' || LPAD(ranked.seq::text, 5, '0')
FROM ranked
WHERE b."id" = ranked.id;

-- Enforce not null + uniqueness
ALTER TABLE "Booking" ALTER COLUMN "publicId" SET NOT NULL;

CREATE UNIQUE INDEX "Booking_publicId_key" ON "Booking"("publicId");

-- Seed counters with latest values per year
INSERT INTO "BookingIdCounter" ("year", "current")
SELECT ranked.year, MAX(ranked.seq) AS current
FROM (
    SELECT
        EXTRACT(YEAR FROM "createdAt")::int AS year,
        ROW_NUMBER() OVER (
            PARTITION BY EXTRACT(YEAR FROM "createdAt")
            ORDER BY "createdAt" ASC, "id" ASC
        ) AS seq
    FROM "Booking"
) AS ranked
GROUP BY ranked.year;
