"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { signSession } from "@/lib/jwt";
import { clearSessionCookie, setSessionCookie } from "@/lib/session";
import { hasDatabase } from "@/lib/env";

export interface AuthState {
  error?: string;
}

const registerSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (!hasDatabase()) {
    return { error: "Database not configured yet. Set DATABASE_URL in .env." };
  }
  const parsed = registerSchema.safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  const user = await prisma.user.create({
    data: { email, name: name || null, passwordHash: await hashPassword(password) },
  });

  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name ?? undefined,
    role: user.role,
  });
  await setSessionCookie(token);
  redirect(safeNext(formData.get("next")));
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (!hasDatabase()) {
    return { error: "Database not configured yet. Set DATABASE_URL in .env." };
  }
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }

  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name ?? undefined,
    role: user.role,
  });
  await setSessionCookie(token);
  redirect(safeNext(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/");
}
