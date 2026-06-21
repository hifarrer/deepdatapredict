import { getAllPlans } from "@/lib/plans";
import { PlanForm, type AdminPlan } from "../_components/PlanForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Plans" };

export default async function AdminPlansPage() {
  const plans = await getAllPlans();
  const adminPlans: AdminPlan[] = plans.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    priceCents: p.priceCents,
    yearlyPriceCents: p.yearlyPriceCents,
    monthlyQuota: p.monthlyQuota,
    features: p.features,
    stripeMonthlyPriceId: p.stripeMonthlyPriceId,
    stripeYearlyPriceId: p.stripeYearlyPriceId,
    isActive: p.isActive,
    sortOrder: p.sortOrder,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Plans</h1>
        <p className="text-sm text-slate-500">
          Edit pricing, features, credit quotas, and Stripe price ids.
        </p>
      </div>

      <div className="space-y-5">
        {adminPlans.map((p) => (
          <PlanForm key={p.id} plan={p} />
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Add a new plan</h2>
        <PlanForm />
      </div>
    </div>
  );
}
