-- CreateTable
CREATE TABLE "EasyPicksSnapshot" (
    "id" TEXT NOT NULL DEFAULT 'live',
    "picks" JSONB NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EasyPicksSnapshot_pkey" PRIMARY KEY ("id")
);

