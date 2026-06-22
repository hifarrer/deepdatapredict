"use client";

import { useActionState } from "react";
import {
  updateSiteSettings,
  changeAdminPassword,
  type ActionState,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SiteSettingsForm({
  maxLiveEvents,
  defaultCategoryLimit,
  categoryLimits,
  categories,
  defaultSportLimit,
  sportLimits,
  sports,
}: {
  maxLiveEvents: number;
  defaultCategoryLimit: number;
  categoryLimits: Record<string, number>;
  categories: string[];
  defaultSportLimit: number;
  sportLimits: Record<string, number>;
  sports: string[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateSiteSettings,
    {}
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="defaultCategoryLimit" className="text-sm text-slate-700">
            Default per-category limit
          </Label>
          <Input
            id="defaultCategoryLimit"
            type="number"
            name="defaultCategoryLimit"
            min={1}
            defaultValue={defaultCategoryLimit}
          />
          <p className="text-xs text-slate-400">
            Cap applied to any category without its own limit below.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="maxLiveEvents" className="text-sm text-slate-700">
            Overall ceiling (All tab)
          </Label>
          <Input
            id="maxLiveEvents"
            type="number"
            name="maxLiveEvents"
            min={1}
            defaultValue={maxLiveEvents}
          />
          <p className="text-xs text-slate-400">
            Maximum total events shown on the &ldquo;All&rdquo; tab after per-category caps.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-slate-700">Per-category limits</Label>
        <p className="text-xs text-slate-400">
          Maximum live events to show for each category. A category only shows up to
          its limit (or fewer if Kalshi has fewer live events). Blank = use the default.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <div key={cat} className="space-y-1">
              <Label htmlFor={`cat__${cat}`} className="text-xs text-slate-600">
                {cat}
              </Label>
              <Input
                id={`cat__${cat}`}
                type="number"
                name={`cat__${cat}`}
                min={1}
                placeholder={String(defaultCategoryLimit)}
                defaultValue={categoryLimits[cat] ?? ""}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-100 pt-4">
        <Label className="text-sm text-slate-700">Per-sport limits (within Sports)</Label>
        <p className="text-xs text-slate-400">
          Caps each sport inside the Sports category. The total Sports cap above still
          applies. Blank = use the default below.
        </p>
        <div className="max-w-xs space-y-1 pb-1">
          <Label htmlFor="defaultSportLimit" className="text-xs text-slate-600">
            Default per-sport limit
          </Label>
          <Input
            id="defaultSportLimit"
            type="number"
            name="defaultSportLimit"
            min={1}
            defaultValue={defaultSportLimit}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sports.map((sport) => (
            <div key={sport} className="space-y-1">
              <Label htmlFor={`sport__${sport}`} className="text-xs text-slate-600">
                {sport}
              </Label>
              <Input
                id={`sport__${sport}`}
                type="number"
                name={`sport__${sport}`}
                min={1}
                placeholder={String(defaultSportLimit)}
                defaultValue={sportLimits[sport] ?? ""}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {state.success && (
          <span className="text-sm text-emerald-600">{state.success}</span>
        )}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    changeAdminPassword,
    {}
  );

  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <div className="space-y-1">
        <Label htmlFor="currentPassword" className="text-sm text-slate-700">
          Current password
        </Label>
        <Input id="currentPassword" type="password" name="currentPassword" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="newPassword" className="text-sm text-slate-700">
          New password
        </Label>
        <Input id="newPassword" type="password" name="newPassword" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirmPassword" className="text-sm text-slate-700">
          Confirm new password
        </Label>
        <Input id="confirmPassword" type="password" name="confirmPassword" required />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Updating…" : "Change password"}
        </Button>
        {state.success && (
          <span className="text-sm text-emerald-600">{state.success}</span>
        )}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
