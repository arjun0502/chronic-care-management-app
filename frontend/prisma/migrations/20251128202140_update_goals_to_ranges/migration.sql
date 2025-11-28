/*
  Warnings:

  - You are about to drop the column `diastolicGoal` on the `Goal` table. All the data in the column will be lost.
  - You are about to drop the column `glucoseGoal` on the `Goal` table. All the data in the column will be lost.
  - You are about to drop the column `systolicGoal` on the `Goal` table. All the data in the column will be lost.
  - You are about to drop the column `weightGoal` on the `Goal` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Goal" DROP COLUMN "diastolicGoal",
DROP COLUMN "glucoseGoal",
DROP COLUMN "systolicGoal",
DROP COLUMN "weightGoal",
ADD COLUMN     "diastolicMax" DOUBLE PRECISION,
ADD COLUMN     "diastolicMin" DOUBLE PRECISION,
ADD COLUMN     "glucoseMax" DOUBLE PRECISION,
ADD COLUMN     "glucoseMin" DOUBLE PRECISION,
ADD COLUMN     "systolicMax" DOUBLE PRECISION,
ADD COLUMN     "systolicMin" DOUBLE PRECISION,
ADD COLUMN     "weightBaseline" DOUBLE PRECISION,
ADD COLUMN     "weightDailyAlertThreshold" DOUBLE PRECISION,
ADD COLUMN     "weightWeeklyAlertThreshold" DOUBLE PRECISION;
