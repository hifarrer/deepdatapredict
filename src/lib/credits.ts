import { prisma } from "@/lib/db";

/** Default monthly credits for a user with no assigned plan. */
const DEFAULT_FREE_QUOTA = 3;

function isSameMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

/**
 * Lazily reset a user's credits to their plan quota at the start of each month.
 * Returns the (possibly refreshed) current balance.
 */
export async function ensureMonthlyCredits(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { plan: true },
  });
  if (!user) return 0;

  const now = new Date();
  const quota = user.plan?.monthlyQuota ?? DEFAULT_FREE_QUOTA;

  // Reset when we've never reset, or the last reset was in an earlier month.
  if (!user.creditsResetAt || !isSameMonth(user.creditsResetAt, now)) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { credits: quota, creditsResetAt: now },
    });
    return updated.credits;
  }

  return user.credits;
}

/**
 * Atomically charge a single credit. Returns true if a credit was available
 * and deducted, false if the user had none.
 */
export async function chargeOneCredit(userId: string): Promise<boolean> {
  const res = await prisma.user.updateMany({
    where: { id: userId, credits: { gte: 1 } },
    data: { credits: { decrement: 1 } },
  });
  return res.count > 0;
}

/** Read the current credit balance (without triggering a reset). */
export async function getCredits(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  return user?.credits ?? 0;
}
