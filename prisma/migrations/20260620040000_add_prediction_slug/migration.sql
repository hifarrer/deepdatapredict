-- AlterTable
ALTER TABLE "Prediction" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_slug_key" ON "Prediction"("slug");
