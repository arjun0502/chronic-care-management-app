/*
  Warnings:

  - You are about to drop the column `familyHistory` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `smokingStatus` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "familyHistory",
DROP COLUMN "gender",
DROP COLUMN "smokingStatus",
ADD COLUMN     "alcoholUse" TEXT,
ADD COLUMN     "familyHistoryHeartDisease" TEXT,
ADD COLUMN     "height" DOUBLE PRECISION,
ADD COLUMN     "sex" TEXT,
ADD COLUMN     "smokingHistory" TEXT,
ADD COLUMN     "weight" DOUBLE PRECISION;
