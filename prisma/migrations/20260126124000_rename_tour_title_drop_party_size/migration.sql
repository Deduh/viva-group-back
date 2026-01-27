ALTER TABLE "Tour"
RENAME COLUMN "destination" TO "title";

ALTER TABLE "Tour"
DROP COLUMN "maxPartySize",
DROP COLUMN "minPartySize";
