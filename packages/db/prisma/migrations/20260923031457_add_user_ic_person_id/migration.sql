-- AlterTable
ALTER TABLE "User" ADD COLUMN     "icPersonId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_districtId_icPersonId_key" ON "User"("districtId", "icPersonId");
