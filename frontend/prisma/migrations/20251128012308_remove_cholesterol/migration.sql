/*
  Warnings:

  - You are about to drop the column `cholesterolGoal` on the `Goal` table. All the data in the column will be lost.
  - You are about to drop the column `cholesterol` on the `Measurement` table. All the data in the column will be lost.
  - You are about to drop the column `cholesterolRaw` on the `Measurement` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Goal" DROP COLUMN "cholesterolGoal";

-- AlterTable
ALTER TABLE "Measurement" DROP COLUMN "cholesterol",
DROP COLUMN "cholesterolRaw";
