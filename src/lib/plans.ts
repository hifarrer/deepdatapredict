import { prisma } from "@/lib/db";

export interface PlanDTO {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  yearlyPriceCents: number | null;
  monthlyQuota: number | null;
  features: string[];
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
  isActive: boolean;
  sortOrder: number;
}

function toFeatures(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  return [];
}

function map(p: {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  yearlyPriceCents: number | null;
  monthlyQuota: number | null;
  features: unknown;
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
  isActive: boolean;
  sortOrder: number;
}): PlanDTO {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    priceCents: p.priceCents,
    yearlyPriceCents: p.yearlyPriceCents,
    monthlyQuota: p.monthlyQuota,
    features: toFeatures(p.features),
    stripeMonthlyPriceId: p.stripeMonthlyPriceId,
    stripeYearlyPriceId: p.stripeYearlyPriceId,
    isActive: p.isActive,
    sortOrder: p.sortOrder,
  };
}

/** Active plans for the public plans page, ordered for display. */
export async function getActivePlans(): Promise<PlanDTO[]> {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }],
  });
  return plans.map(map);
}

/** All plans (admin view), ordered for display. */
export async function getAllPlans(): Promise<PlanDTO[]> {
  const plans = await prisma.plan.findMany({
    orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }],
  });
  return plans.map(map);
}

/** Format a price in cents as a dollar string ("$0", "$9", "$9.50"). */
export function formatPrice(cents: number): string {
  if (cents === 0) return "$0";
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}
