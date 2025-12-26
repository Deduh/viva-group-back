-- CreateTable
CREATE TABLE "BookingReadState" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingReadState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupTransportBookingReadState" (
    "id" TEXT NOT NULL,
    "groupTransportBookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupTransportBookingReadState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingReadState_userId_idx" ON "BookingReadState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingReadState_bookingId_userId_key" ON "BookingReadState"("bookingId", "userId");

-- CreateIndex
CREATE INDEX "GroupTransportBookingReadState_userId_idx" ON "GroupTransportBookingReadState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupTransportBookingReadState_groupTransportBookingId_user_key" ON "GroupTransportBookingReadState"("groupTransportBookingId", "userId");

-- AddForeignKey
ALTER TABLE "BookingReadState" ADD CONSTRAINT "BookingReadState_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingReadState" ADD CONSTRAINT "BookingReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupTransportBookingReadState" ADD CONSTRAINT "GroupTransportBookingReadState_groupTransportBookingId_fkey" FOREIGN KEY ("groupTransportBookingId") REFERENCES "GroupTransportBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupTransportBookingReadState" ADD CONSTRAINT "GroupTransportBookingReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
