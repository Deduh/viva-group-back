-- CreateEnum
CREATE TYPE "CharterTripType" AS ENUM ('ONE_WAY', 'ROUND_TRIP');

-- AlterTable
ALTER TABLE "CharterBooking"
ADD COLUMN "tripType" "CharterTripType" NOT NULL DEFAULT 'ROUND_TRIP',
ALTER COLUMN "dateTo" DROP NOT NULL;
