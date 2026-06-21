import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getActivePlans, formatPrice } from "@/lib/plans";

export const metadata = { title: "Plans · DeepDataPredict" };
export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const plans = await getActivePlans();
  // Highlight the mid / most popular tier (the "basic" plan, or the middle one).
  const highlightSlug =
    plans.find((p) => p.slug === "basic")?.slug ??
    plans[Math.floor(plans.length / 2)]?.slug;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Plans</h1>
        <p className="mt-3 text-slate-600">
          Every plan includes AI predictions with live web research. Each prediction
          uses one credit.
        </p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {plans.map((p) => {
          const highlight = p.slug === highlightSlug;
          const free = p.priceCents === 0;
          return (
            <div
              key={p.id}
              className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                highlight
                  ? "border-emerald-500 ring-1 ring-emerald-500"
                  : "border-slate-200"
              }`}
            >
              <h2 className="font-semibold text-slate-900">{p.name}</h2>
              <p className="text-sm text-slate-500">
                {p.monthlyQuota
                  ? `${p.monthlyQuota} predictions / month`
                  : "Custom usage"}
              </p>
              <p className="mt-4 text-3xl font-bold text-slate-900">
                {formatPrice(p.priceCents)}
                <span className="text-base font-normal text-slate-400">/mo</span>
              </p>
              {p.yearlyPriceCents ? (
                <p className="text-xs text-slate-400">
                  or {formatPrice(p.yearlyPriceCents)}/yr
                </p>
              ) : null}
              <ul className="mt-6 flex-1 space-y-2 text-sm text-slate-600">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="mt-6"
                variant={highlight ? "default" : "outline"}
              >
                <Link href="/register">{free ? "Get started" : "Choose plan"}</Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
