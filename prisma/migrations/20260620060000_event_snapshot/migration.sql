-- CreateTable
CREATE TABLE "EventSnapshot" (
    "id" TEXT NOT NULL DEFAULT 'live',
    "events" JSONB NOT NULL,
    "categories" JSONB NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSnapshot_pkey" PRIMARY KEY ("id")
);
