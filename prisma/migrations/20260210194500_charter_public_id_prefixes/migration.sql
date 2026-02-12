-- Rename charter publicId prefixes:
-- - CharterFlight:  VIVA-CHFL-YYYY-#####   -> VIVA-AVFL-YYYY-#####
-- - CharterBooking: VIVA-CHBOOK-YYYY-##### -> VIVA-AVBOOK-YYYY-#####
--
-- This migration can run before CharterFlight exists in some environments,
-- so guard updates behind table existence checks.
DO $$
BEGIN
  IF to_regclass('"CharterFlight"') IS NOT NULL THEN
    EXECUTE '
      UPDATE "CharterFlight"
      SET "publicId" = regexp_replace("publicId", ''^VIVA-CHFL-'', ''VIVA-AVFL-'')
      WHERE "publicId" LIKE ''VIVA-CHFL-%'';
    ';
  END IF;

  IF to_regclass('"CharterBooking"') IS NOT NULL THEN
    EXECUTE '
      UPDATE "CharterBooking"
      SET "publicId" = regexp_replace("publicId", ''^VIVA-CHBOOK-'', ''VIVA-AVBOOK-'')
      WHERE "publicId" LIKE ''VIVA-CHBOOK-%'';
    ';
  END IF;
END $$;
