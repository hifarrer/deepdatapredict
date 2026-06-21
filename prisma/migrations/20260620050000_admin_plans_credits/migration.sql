-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripeMonthlyPriceId" TEXT,
ADD COLUMN     "stripeYearlyPriceId" TEXT,
ADD COLUMN     "yearlyPriceCents" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "credits" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "creditsResetAt" TIMESTAMP(3),
ADD COLUMN     "planId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
