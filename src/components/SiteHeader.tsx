import Link from "next/link";
import { TrendingUp, LogOut } from "lucide-react";
import { getSession } from "@/lib/session";
import { logoutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href={session ? "/dashboard" : "/"} className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <TrendingUp className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold text-slate-900">DeepDataPredict</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            {session && (
              <Link href="/dashboard" className="hover:text-slate-900">
                Dashboard
              </Link>
            )}
            {session && (
              <Link href="/history" className="hover:text-slate-900">
                History
              </Link>
            )}
            <Link href="/how-it-works" className="hover:text-slate-900">
              How it works
            </Link>
            <Link href="/faq" className="hover:text-slate-900">
              FAQ
            </Link>
            <Link href="/plans" className="hover:text-slate-900">
              Plans
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {session ? (
            <>
              <span className="hidden text-sm text-slate-500 sm:inline">
                {session.name || session.email}
              </span>
              <form action={logoutAction}>
                <Button variant="ghost" size="sm" type="submit">
                  <LogOut className="h-4 w-4" />
                  Log out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
