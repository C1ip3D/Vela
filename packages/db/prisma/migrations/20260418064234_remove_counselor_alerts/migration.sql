/*
  Warnings:

  - You are about to drop the `CounselorAlert` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CounselorAlert" DROP CONSTRAINT "CounselorAlert_advisorLogId_fkey";

-- DropForeignKey
ALTER TABLE "CounselorAlert" DROP CONSTRAINT "CounselorAlert_counselorId_fkey";

-- DropForeignKey
ALTER TABLE "CounselorAlert" DROP CONSTRAINT "CounselorAlert_targetUserId_fkey";

-- DropTable
DROP TABLE "CounselorAlert";

-- DropEnum
DROP TYPE "AlertStatus";
