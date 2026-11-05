-- CreateEnum
CREATE TYPE "ScheduleSource" AS ENUM ('INFINITE_CAMPUS', 'MANUAL');
-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "teacher" TEXT,
    "room" TEXT,
    "period" TEXT NOT NULL,
    "dayType" TEXT NOT NULL,
    "termName" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "source" "ScheduleSource" NOT NULL DEFAULT 'INFINITE_CAMPUS',
    CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "BellPeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayType" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    CONSTRAINT "BellPeriod_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "ScheduleEntry_userId_idx" ON "ScheduleEntry"("userId");
-- CreateIndex
CREATE INDEX "BellPeriod_userId_idx" ON "BellPeriod"("userId");
-- CreateIndex
CREATE UNIQUE INDEX "BellPeriod_userId_dayType_period_key" ON "BellPeriod"("userId", "dayType", "period");
-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "BellPeriod" ADD CONSTRAINT "BellPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
