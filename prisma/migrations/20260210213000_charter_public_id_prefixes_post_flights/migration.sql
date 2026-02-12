-- Ensure charter publicId prefixes are AVFL/AVBOOK after CharterFlight migration.
-- Safe to run multiple times.

UPDATE "CharterFlight"
SET "publicId" = regexp_replace("publicId", '^VIVA-CHFL-', 'VIVA-AVFL-')
WHERE "publicId" LIKE 'VIVA-CHFL-%';

UPDATE "CharterBooking"
SET "publicId" = regexp_replace("publicId", '^VIVA-CHBOOK-', 'VIVA-AVBOOK-')
WHERE "publicId" LIKE 'VIVA-CHBOOK-%';

