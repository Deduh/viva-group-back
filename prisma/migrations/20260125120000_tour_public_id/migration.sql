-- CreateTable
CREATE TABLE "TourIdCounter" (
    "year" INTEGER NOT NULL,
    "current" INTEGER NOT NULL,

    CONSTRAINT "TourIdCounter_pkey" PRIMARY KEY ("year")
);

-- AlterTable
ALTER TABLE "Tour" ADD COLUMN "publicId" TEXT;

-- Backfill publicId for existing tours
WITH ranked AS (
    SELECT
        "id",
        EXTRACT(YEAR FROM "createdAt")::int AS year,
        ROW_NUMBER() OVER (
            PARTITION BY EXTRACT(YEAR FROM "createdAt")
            ORDER BY "createdAt" ASC, "id" ASC
        ) AS seq
    FROM "Tour"
)
UPDATE "Tour" AS t
SET "publicId" = 'VIVA-TOUR-' || ranked.year || '-' || LPAD(ranked.seq::text, 5, '0')
FROM ranked
WHERE t."id" = ranked.id;

-- Enforce not null + uniqueness
ALTER TABLE "Tour" ALTER COLUMN "publicId" SET NOT NULL;

CREATE UNIQUE INDEX "Tour_publicId_key" ON "Tour"("publicId");

-- Seed counters with latest values per year
INSERT INTO "TourIdCounter" ("year", "current")
SELECT ranked.year, MAX(ranked.seq) AS current
FROM (
    SELECT
        EXTRACT(YEAR FROM "createdAt")::int AS year,
        ROW_NUMBER() OVER (
            PARTITION BY EXTRACT(YEAR FROM "createdAt")
            ORDER BY "createdAt" ASC, "id" ASC
        ) AS seq
    FROM "Tour"
) AS ranked
GROUP BY ranked.year;
