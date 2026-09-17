-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdvisorLogType" ADD VALUE 'GRADE_ALERT';
ALTER TYPE "AdvisorLogType" ADD VALUE 'ASSIGNMENT_GRADED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "expoPushToken" TEXT;

-- CreateTable
CREATE TABLE "AssignmentGrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "assignmentKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "dueDate" TEXT,
    "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentGrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssignmentGrade_userId_courseId_idx" ON "AssignmentGrade"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentGrade_userId_courseId_assignmentKey_key" ON "AssignmentGrade"("userId", "courseId", "assignmentKey");

-- AddForeignKey
ALTER TABLE "AssignmentGrade" ADD CONSTRAINT "AssignmentGrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentGrade" ADD CONSTRAINT "AssignmentGrade_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
