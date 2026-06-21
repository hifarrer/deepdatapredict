"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { setSiteSetting } from "@/lib/settings";

export interface ActionState {
  error?: string;
  success?: string;
}

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = str(v);
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

function featuresFromText(v: FormDataEntryValue | null): string[] {
  return str(v)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

// ---- Users -------------------------------------------------------------

export async function updateUser(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const userId = str(formData.get("userId"));
  if (!userId) return { error: "Missing user id." };

  const role = str(formData.get("role")) === "ADMIN" ? "ADMIN" : "USER";
  const planId = str(formData.get("planId"));
  const credits = intOrNull(formData.get("credits"));

  await prisma.user.update({
    where: { id: userId },
    data: {
      role,
      planId: planId || null,
      ...(credits !== null ? { credits } : {}),
    },
  });

  revalidatePath("/admin/users");
  return { success: "User updated." };
}

// ---- Plans -------------------------------------------------------------

export async function upsertPlan(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const id = str(formData.get("id"));
  const slug = str(formData.get("slug")).toLowerCase();
  const name = str(formData.get("name"));
  if (!slug || !name) return { error: "Name and slug are required." };

  const data = {
    slug,
    name,
    priceCents: intOrNull(formData.get("priceCents")) ?? 0,
    yearlyPriceCents: intOrNull(formData.get("yearlyPriceCents")),
    monthlyQuota: intOrNull(formData.get("monthlyQuota")),
    features: featuresFromText(formData.get("features")),
    stripeMonthlyPriceId: str(formData.get("stripeMonthlyPriceId")) || null,
    stripeYearlyPriceId: str(formData.get("stripeYearlyPriceId")) || null,
    isActive: str(formData.get("isActive")) === "on",
    sortOrder: intOrNull(formData.get("sortOrder")) ?? 0,
  };

  try {
    if (id) {
      await prisma.plan.update({ where: { id }, data });
    } else {
      await prisma.plan.create({ data });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save plan.";
    return { error: message.includes("Unique") ? "That slug is already in use." : message };
  }

  revalidatePath("/admin/plans");
  revalidatePath("/plans");
  return { success: "Plan saved." };
}

export async function deletePlan(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const id = str(formData.get("id"));
  if (!id) return { error: "Missing plan id." };

  const inUse = await prisma.user.count({ where: { planId: id } });
  if (inUse > 0) {
    return { error: `Cannot delete: ${inUse} user(s) are on this plan.` };
  }

  await prisma.plan.delete({ where: { id } });
  revalidatePath("/admin/plans");
  revalidatePath("/plans");
  return { success: "Plan deleted." };
}

// ---- Site settings -----------------------------------------------------

export async function updateSiteSettings(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const maxLiveEvents = intOrNull(formData.get("maxLiveEvents"));
  if (maxLiveEvents === null || maxLiveEvents < 1) {
    return { error: "Overall ceiling must be a positive number." };
  }

  const defaultCategoryLimit = intOrNull(formData.get("defaultCategoryLimit"));
  if (defaultCategoryLimit === null || defaultCategoryLimit < 1) {
    return { error: "Default per-category limit must be a positive number." };
  }

  // Collect per-category limits from the `cat__<Category>` fields. Blank or
  // non-positive entries are dropped so the category falls back to the default.
  const categoryLimits: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("cat__")) continue;
    const n = intOrNull(value);
    if (n !== null && n >= 1) categoryLimits[key.slice("cat__".length)] = n;
  }

  await setSiteSetting("maxLiveEvents", maxLiveEvents);
  await setSiteSetting("defaultCategoryLimit", defaultCategoryLimit);
  await setSiteSetting("categoryLimits", categoryLimits);
  revalidatePath("/admin/settings");
  return { success: "Settings saved." };
}

export async function changeAdminPassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const current = str(formData.get("currentPassword"));
  const next = str(formData.get("newPassword"));
  const confirm = str(formData.get("confirmPassword"));

  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== confirm) return { error: "New passwords do not match." };

  const user = await prisma.user.findUnique({ where: { id: admin.sub } });
  if (!user) return { error: "Account not found." };

  const ok = await verifyPassword(current, user.passwordHash);
  if (!ok) return { error: "Current password is incorrect." };

  await prisma.user.update({
    where: { id: admin.sub },
    data: { passwordHash: await hashPassword(next) },
  });

  return { success: "Password updated." };
}
