import Link from "next/link";
import { Users, CreditCard, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Overview" };

export default async function AdminOverviewPage() {
  const [userCount, predictionCount, activePlanCount] = await Promise.all([
    prisma.user.count(),
    prisma.prediction.count(),
    prisma.plan.count({ where: { isActive: true } }),
  ]);

  const stats = [
    { label: "Users", value: userCount, icon: Users, href: "/admin/users" },
    {
      label: "Predictions",
      value: predictionCount,
      icon: Sparkles,
      href: "/admin/users",
    },
    {
      label: "Active plans",
      value: activePlanCount,
      icon: CreditCard,
      href: "/admin/plans",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500">Manage users, plans, and site settings.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href}>
            <Card className="transition hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{value}</p>
                  <p className="text-sm text-slate-500">{label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
