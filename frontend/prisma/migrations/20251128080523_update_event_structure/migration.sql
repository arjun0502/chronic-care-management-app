/*
  Warnings:

  - You are about to drop the column `severity` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Event` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Event" DROP COLUMN "severity",
DROP COLUMN "type",
ADD COLUMN     "lifestyleChanges" TEXT[],
ADD COLUMN     "medicationChanges" TEXT[];
