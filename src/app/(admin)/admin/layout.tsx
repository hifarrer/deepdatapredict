import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Users, CreditCard, Settings, ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/plans", label: "Plans", icon: CreditCard },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense-in-depth: middleware already gates /admin, but re-check here.
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (session.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row">
        <aside className="md:w-56 md:shrink-0">
          <div className="flex items-center gap-2 px-2 pb-4">
            <span className="text-lg font-bold text-slate-900">Admin</span>
          </div>
          <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
            <Link
              href="/dashboard"
              className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to app
            </Link>
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
