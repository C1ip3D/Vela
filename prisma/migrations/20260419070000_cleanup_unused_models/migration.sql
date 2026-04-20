-- Drop unused tables (order matters for FK constraints)
DROP TABLE IF EXISTS "SimulationPlaceholder" CASCADE;
DROP TABLE IF EXISTS "SimulationOverride" CASCADE;
DROP TABLE IF EXISTS "Simulation" CASCADE;
DROP TABLE IF EXISTS "Submission" CASCADE;
DROP TABLE IF EXISTS "Assignment" CASCADE;
DROP TABLE IF EXISTS "WeightCategory" CASCADE;
DROP TABLE IF EXISTS "GradingPeriod" CASCADE;
DROP TABLE IF EXISTS "CourseRecommendation" CASCADE;

-- Remove unused AdvisorLogType enum values
-- Step 1: remove old enum values from existing rows (none should exist, but just in case)
UPDATE "AdvisorLog" SET "logType" = 'GRADE_ALERT'
  WHERE "logType" IN ('GPA_DROP_ALERT','MISSING_ASSIGNMENT_ALERT','POSITIVE_TREND','COURSE_RECOMMENDATION','MILESTONE_REACHED');

-- Step 2: recreate enum with only used values
ALTER TYPE "AdvisorLogType" RENAME TO "AdvisorLogType_old";
CREATE TYPE "AdvisorLogType" AS ENUM ('GRADE_ALERT', 'ASSIGNMENT_GRADED');
ALTER TABLE "AdvisorLog" ALTER COLUMN "logType" TYPE "AdvisorLogType" USING "logType"::text::"AdvisorLogType";
DROP TYPE "AdvisorLogType_old";
