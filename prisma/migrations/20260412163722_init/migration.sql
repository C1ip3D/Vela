-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'COUNSELOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "CourseType" AS ENUM ('STANDARD', 'ADVANCED', 'HONORS', 'AP', 'DUAL_ENROLLMENT');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AdvisorLogType" AS ENUM ('GPA_DROP_ALERT', 'MISSING_ASSIGNMENT_ALERT', 'POSITIVE_TREND', 'COURSE_RECOMMENDATION', 'MILESTONE_REACHED');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('INFINITE_CAMPUS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "canvasUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "canvasToken" TEXT,
    "canvasRefresh" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "telegramChatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "canvasCourseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "courseType" "CourseType" NOT NULL DEFAULT 'STANDARD',
    "creditHours" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "apBoost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" "DataSource" NOT NULL DEFAULT 'INFINITE_CAMPUS',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightCategory" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "canvasCategoryId" TEXT,
    "name" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "dropLowest" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WeightCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradingPeriod" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "canvasPeriodId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "canvasEnrollId" TEXT NOT NULL,
    "currentGrade" DOUBLE PRECISION,
    "letterGrade" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "canvasAssignId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "gradingPeriodId" TEXT,
    "weightCategoryId" TEXT,
    "title" TEXT NOT NULL,
    "pointsPossible" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "source" "DataSource" NOT NULL DEFAULT 'INFINITE_CAMPUS',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "canvasSubId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "late" BOOLEAN NOT NULL DEFAULT false,
    "missing" BOOLEAN NOT NULL DEFAULT false,
    "excused" BOOLEAN NOT NULL DEFAULT false,
    "gradedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "percentageGrade" DOUBLE PRECISION NOT NULL,
    "gpaPoints" DOUBLE PRECISION NOT NULL,
    "letterGrade" TEXT NOT NULL,
    "missingCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GradeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GpaSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cumulativeGpa" DOUBLE PRECISION NOT NULL,
    "termGpa" DOUBLE PRECISION NOT NULL,
    "weightedGpa" DOUBLE PRECISION NOT NULL,
    "unweightedGpa" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "term" TEXT NOT NULL,

    CONSTRAINT "GpaSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Simulation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Scenario',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "baseGrade" DOUBLE PRECISION NOT NULL,
    "projectedGrade" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "projectedGpa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Simulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationOverride" (
    "id" TEXT NOT NULL,
    "simulationId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "overrideScore" DOUBLE PRECISION NOT NULL,
    "originalScore" DOUBLE PRECISION,

    CONSTRAINT "SimulationOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationPlaceholder" (
    "id" TEXT NOT NULL,
    "simulationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "weightCategoryId" TEXT NOT NULL,
    "pointsPossible" DOUBLE PRECISION NOT NULL,
    "projectedScore" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SimulationPlaceholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "logType" "AdvisorLogType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "triggerData" JSONB NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CounselorAlert" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "counselorId" TEXT NOT NULL,
    "advisorLogId" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "telegramSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CounselorAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "catalogCourseId" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "prerequisitesMet" BOOLEAN NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_canvasUserId_key" ON "User"("canvasUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Course_canvasCourseId_key" ON "Course"("canvasCourseId");

-- CreateIndex
CREATE INDEX "WeightCategory_courseId_idx" ON "WeightCategory"("courseId");

-- CreateIndex
CREATE INDEX "GradingPeriod_courseId_idx" ON "GradingPeriod"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_canvasEnrollId_key" ON "Enrollment"("canvasEnrollId");

-- CreateIndex
CREATE INDEX "Enrollment_userId_idx" ON "Enrollment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_userId_courseId_key" ON "Enrollment"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_canvasAssignId_key" ON "Assignment"("canvasAssignId");

-- CreateIndex
CREATE INDEX "Assignment_courseId_dueDate_idx" ON "Assignment"("courseId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_canvasSubId_key" ON "Submission"("canvasSubId");

-- CreateIndex
CREATE INDEX "Submission_assignmentId_userId_idx" ON "Submission"("assignmentId", "userId");

-- CreateIndex
CREATE INDEX "Submission_userId_missing_idx" ON "Submission"("userId", "missing");

-- CreateIndex
CREATE INDEX "GradeHistory_userId_recordedAt_idx" ON "GradeHistory"("userId", "recordedAt");

-- CreateIndex
CREATE INDEX "GpaSnapshot_userId_recordedAt_idx" ON "GpaSnapshot"("userId", "recordedAt");

-- CreateIndex
CREATE INDEX "Simulation_userId_courseId_idx" ON "Simulation"("userId", "courseId");

-- CreateIndex
CREATE INDEX "AdvisorLog_userId_createdAt_idx" ON "AdvisorLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CounselorAlert_counselorId_status_idx" ON "CounselorAlert"("counselorId", "status");

-- CreateIndex
CREATE INDEX "CourseRecommendation_userId_idx" ON "CourseRecommendation"("userId");

-- AddForeignKey
ALTER TABLE "WeightCategory" ADD CONSTRAINT "WeightCategory_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingPeriod" ADD CONSTRAINT "GradingPeriod_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_gradingPeriodId_fkey" FOREIGN KEY ("gradingPeriodId") REFERENCES "GradingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_weightCategoryId_fkey" FOREIGN KEY ("weightCategoryId") REFERENCES "WeightCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHistory" ADD CONSTRAINT "GradeHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GpaSnapshot" ADD CONSTRAINT "GpaSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationOverride" ADD CONSTRAINT "SimulationOverride_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationOverride" ADD CONSTRAINT "SimulationOverride_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationPlaceholder" ADD CONSTRAINT "SimulationPlaceholder_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationPlaceholder" ADD CONSTRAINT "SimulationPlaceholder_weightCategoryId_fkey" FOREIGN KEY ("weightCategoryId") REFERENCES "WeightCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorLog" ADD CONSTRAINT "AdvisorLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounselorAlert" ADD CONSTRAINT "CounselorAlert_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounselorAlert" ADD CONSTRAINT "CounselorAlert_counselorId_fkey" FOREIGN KEY ("counselorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounselorAlert" ADD CONSTRAINT "CounselorAlert_advisorLogId_fkey" FOREIGN KEY ("advisorLogId") REFERENCES "AdvisorLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRecommendation" ADD CONSTRAINT "CourseRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
