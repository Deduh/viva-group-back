-- Add participants array and drop legacy partySize
ALTER TABLE "Booking"
ADD COLUMN "participants" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "Booking"
DROP COLUMN "partySize";
