-- CreateEnum
CREATE TYPE "ContactRequestStatus" AS ENUM ('new', 'handled');

-- CreateEnum
CREATE TYPE "ContactRequestSource" AS ENUM ('contacts_form');

-- CreateEnum
CREATE TYPE "MailingSubscriberStatus" AS ENUM ('active', 'unsubscribed', 'pending');

-- CreateEnum
CREATE TYPE "MailingSubscriberSource" AS ENUM ('home_mailing');

-- CreateEnum
CREATE TYPE "MailingCampaignStatus" AS ENUM ('draft', 'sending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "MailingLogStatus" AS ENUM ('sent', 'failed');

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'new',
    "source" "ContactRequestSource" NOT NULL DEFAULT 'contacts_form',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailingSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "MailingSubscriberStatus" NOT NULL DEFAULT 'pending',
    "source" "MailingSubscriberSource" NOT NULL DEFAULT 'home_mailing',
    "confirmToken" TEXT NOT NULL,
    "unsubToken" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailingSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailingCampaign" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "MailingCampaignStatus" NOT NULL DEFAULT 'draft',
    "createdById" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailingLog" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "MailingLogStatus" NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailingLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactRequest_email_idx" ON "ContactRequest"("email");

-- CreateIndex
CREATE INDEX "ContactRequest_status_idx" ON "ContactRequest"("status");

-- CreateIndex
CREATE INDEX "ContactRequest_createdAt_idx" ON "ContactRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MailingSubscriber_email_key" ON "MailingSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MailingSubscriber_confirmToken_key" ON "MailingSubscriber"("confirmToken");

-- CreateIndex
CREATE UNIQUE INDEX "MailingSubscriber_unsubToken_key" ON "MailingSubscriber"("unsubToken");

-- CreateIndex
CREATE INDEX "MailingCampaign_status_idx" ON "MailingCampaign"("status");

-- CreateIndex
CREATE INDEX "MailingCampaign_createdAt_idx" ON "MailingCampaign"("createdAt");

-- CreateIndex
CREATE INDEX "MailingLog_campaignId_idx" ON "MailingLog"("campaignId");

-- CreateIndex
CREATE INDEX "MailingLog_subscriberId_idx" ON "MailingLog"("subscriberId");

-- AddForeignKey
ALTER TABLE "MailingCampaign" ADD CONSTRAINT "MailingCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailingLog" ADD CONSTRAINT "MailingLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MailingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailingLog" ADD CONSTRAINT "MailingLog_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "MailingSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
