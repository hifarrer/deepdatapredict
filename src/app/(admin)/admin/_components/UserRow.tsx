"use client";

import { useActionState } from "react";
import { updateUser, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  credits: number;
  planId: string | null;
  createdAt: string;
}

export interface PlanOption {
  id: string;
  name: string;
}

const selectClass =
  "h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500";

export function UserRow({ user, plans }: { user: AdminUser; plans: PlanOption[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateUser,
    {}
  );

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-3 border-b border-slate-100 px-4 py-3 text-sm md:grid-cols-[2fr_1fr_1.2fr_0.8fr_auto] md:items-center"
    >
      <input type="hidden" name="userId" value={user.id} />

      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{user.email}</p>
        <p className="truncate text-xs text-slate-400">
          {user.name || "—"} · joined {new Date(user.createdAt).toLocaleDateString()}
        </p>
      </div>

      <select name="role" defaultValue={user.role} className={selectClass}>
        <option value="USER">User</option>
        <option value="ADMIN">Admin</option>
      </select>

      <select name="planId" defaultValue={user.planId ?? ""} className={selectClass}>
        <option value="">No plan</option>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <Input
        type="number"
        name="credits"
        defaultValue={user.credits}
        min={0}
        className="h-9"
        aria-label="Credits"
      />

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.success && <span className="text-xs text-emerald-600">✓</span>}
        {state.error && (
          <span className="text-xs text-red-600" title={state.error}>
            !
          </span>
        )}
      </div>
    </form>
  );
}
