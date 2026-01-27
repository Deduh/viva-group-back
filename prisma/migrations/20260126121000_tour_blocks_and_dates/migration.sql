ALTER TABLE "Tour"
ADD COLUMN "fullDescriptionBlocks" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "dateFrom" TIMESTAMP(3),
ADD COLUMN "dateTo" TIMESTAMP(3),
ADD COLUMN "durationDays" INTEGER,
ADD COLUMN "durationNights" INTEGER;

ALTER TABLE "Tour"
DROP COLUMN "fullDescription",
DROP COLUMN "properties",
DROP COLUMN "duration";
