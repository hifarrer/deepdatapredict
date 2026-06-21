"use client";

import { useActionState } from "react";
import { upsertPlan, deletePlan, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AdminPlan {
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

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-600">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function PlanForm({ plan }: { plan?: AdminPlan }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    upsertPlan,
    {}
  );
  const [delState, delAction, delPending] = useActionState<ActionState, FormData>(
    deletePlan,
    {}
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <form action={formAction} className="space-y-4">
        {plan && <input type="hidden" name="id" value={plan.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input name="name" defaultValue={plan?.name ?? ""} required />
          </Field>
          <Field label="Slug" hint="Stable id, e.g. free / basic / pro">
            <Input name="slug" defaultValue={plan?.slug ?? ""} required />
          </Field>
          <Field label="Monthly price (cents)">
            <Input
              type="number"
              name="priceCents"
              min={0}
              defaultValue={plan?.priceCents ?? 0}
            />
          </Field>
          <Field label="Yearly price (cents)">
            <Input
              type="number"
              name="yearlyPriceCents"
              min={0}
              defaultValue={plan?.yearlyPriceCents ?? ""}
            />
          </Field>
          <Field label="Monthly quota (credits)">
            <Input
              type="number"
              name="monthlyQuota"
              min={0}
              defaultValue={plan?.monthlyQuota ?? ""}
            />
          </Field>
          <Field label="Sort order">
            <Input
              type="number"
              name="sortOrder"
              defaultValue={plan?.sortOrder ?? 0}
            />
          </Field>
        </div>

        <Field label="Features" hint="One feature per line">
          <textarea
            name="features"
            rows={4}
            defaultValue={(plan?.features ?? []).join("\n")}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Stripe monthly price id">
            <Input
              name="stripeMonthlyPriceId"
              placeholder="price_..."
              defaultValue={plan?.stripeMonthlyPriceId ?? ""}
            />
          </Field>
          <Field label="Stripe yearly price id">
            <Input
              name="stripeYearlyPriceId"
              placeholder="price_..."
              defaultValue={plan?.stripeYearlyPriceId ?? ""}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={plan ? plan.isActive : true}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600"
          />
          Active (shown on the public plans page)
        </label>

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : plan ? "Save changes" : "Create plan"}
          </Button>
          {state.success && (
            <span className="text-sm text-emerald-600">{state.success}</span>
          )}
          {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        </div>
      </form>

      {plan && (
        <form action={delAction} className="mt-3 border-t border-slate-100 pt-3">
          <input type="hidden" name="id" value={plan.id} />
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              disabled={delPending}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              {delPending ? "Deleting…" : "Delete plan"}
            </Button>
            {delState.error && (
              <span className="text-sm text-red-600">{delState.error}</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
