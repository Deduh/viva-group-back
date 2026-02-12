-- CreateTable
CREATE TABLE "CharterBooking" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL,
    "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharterBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharterBookingIdCounter" (
    "year" INTEGER NOT NULL,
    "current" INTEGER NOT NULL,

    CONSTRAINT "CharterBookingIdCounter_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "CharterBookingReadState" (
    "id" TEXT NOT NULL,
    "charterBookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharterBookingReadState_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "charterBookingId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CharterBooking_publicId_key" ON "CharterBooking"("publicId");

-- CreateIndex
CREATE INDEX "CharterBooking_userId_idx" ON "CharterBooking"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CharterBookingReadState_charterBookingId_userId_key" ON "CharterBookingReadState"("charterBookingId", "userId");

-- CreateIndex
CREATE INDEX "CharterBookingReadState_userId_idx" ON "CharterBookingReadState"("userId");

-- CreateIndex
CREATE INDEX "Message_charterBookingId_idx" ON "Message"("charterBookingId");

-- AddForeignKey
ALTER TABLE "CharterBooking" ADD CONSTRAINT "CharterBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_charterBookingId_fkey" FOREIGN KEY ("charterBookingId") REFERENCES "CharterBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterBookingReadState" ADD CONSTRAINT "CharterBookingReadState_charterBookingId_fkey" FOREIGN KEY ("charterBookingId") REFERENCES "CharterBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharterBookingReadState" ADD CONSTRAINT "CharterBookingReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

