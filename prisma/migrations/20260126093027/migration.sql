-- This migration was created before the categories column existed in prod.
-- Make it safe/idempotent so deploy does not fail on missing column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Tour' AND column_name = 'categories'
  ) THEN
    ALTER TABLE "Tour" ALTER COLUMN "categories" DROP DEFAULT;
  END IF;
END $$;
