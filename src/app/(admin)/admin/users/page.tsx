import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { UserRow, type AdminUser, type PlanOption } from "../_components/UserRow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = (q ?? "").trim();

  const [users, plans] = await Promise.all([
    prisma.user.findMany({
      where: search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const planOptions: PlanOption[] = plans.map((p) => ({ id: p.id, name: p.name }));
  const rows: AdminUser[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    credits: u.credits,
    planId: u.planId,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="text-sm text-slate-500">
          Manage roles, plan assignments, and credit balances.
        </p>
      </div>

      <form className="max-w-sm">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search by email or name…"
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </form>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[2fr_1fr_1.2fr_0.8fr_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 md:grid">
          <span>User</span>
          <span>Role</span>
          <span>Plan</span>
          <span>Credits</span>
          <span>Actions</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">No users found.</p>
        ) : (
          rows.map((u) => <UserRow key={u.id} user={u} plans={planOptions} />)
        )}
      </Card>
    </div>
  );
}
