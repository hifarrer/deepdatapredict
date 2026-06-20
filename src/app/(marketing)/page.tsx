import Link from "next/link";
import { Brain, LineChart, Search, Sparkles } from "lucide-react";
import { getSession } from "@/lib/session";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  const session = await getSession();
  const ctaHref = session ? "/dashboard" : "/register";

  return (
    <div>
      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
          <Sparkles className="h-4 w-4" />
          AI-powered market analysis
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Predict the outcome of live Kalshi events
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          DeepDataPredict runs a deep Claude-powered analysis on real, live Kalshi
          markets — researching the web, weighing the data, and estimating a
          probability with the key reasons behind it.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href={ctaHref}>
              {session ? "Go to dashboard" : "Get started free"}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/how-it-works">How it works</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Informational only · not financial advice
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: Search,
              title: "Live events only",
              body: "Browse markets currently tradeable on Kalshi, filtered by category and trending volume.",
            },
            {
              icon: Brain,
              title: "Deep AI research",
              body: "Claude searches the web for team form, price trends, polls and news — then weighs it against market prices.",
            },
            {
              icon: LineChart,
              title: "Clear, visual results",
              body: "A probability estimate, confidence, key factors and charts — saved to your account.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
