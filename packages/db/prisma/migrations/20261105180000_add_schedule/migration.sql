-- CreateEnum
CREATE TYPE "ScheduleSource" AS ENUM ('INFINITE_CAMPUS', 'MANUAL', 'UPLOAD');
-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "teacher" TEXT,
    "room" TEXT,
    "days" INTEGER[],
    "term" TEXT,
    "source" "ScheduleSource" NOT NULL DEFAULT 'INFINITE_CAMPUS',
    CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "BellConfig" (
    "userId" TEXT NOT NULL,
    "schedules" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BellConfig_pkey" PRIMARY KEY ("userId")
);
-- CreateIndex
CREATE INDEX "ScheduleEntry_userId_idx" ON "ScheduleEntry"("userId");
-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "BellConfig" ADD CONSTRAINT "BellConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
