import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Plans · DeepDataPredict" };

const plans = [
  {
    name: "Free",
    price: "$0",
    tagline: "Try it out",
    features: ["5 predictions / month", "Live event dashboard", "Saved history"],
    cta: "Get started",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$19",
    tagline: "For serious forecasters",
    features: [
      "Unlimited predictions",
      "Deep web research",
      "Priority analysis queue",
      "Full history & export",
    ],
    cta: "Coming soon",
    highlight: true,
  },
  {
    name: "Team",
    price: "Custom",
    tagline: "For groups",
    features: ["Everything in Pro", "Shared workspace", "API access"],
    cta: "Contact us",
    highlight: false,
  },
];

export default function PlansPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Plans</h1>
        <p className="mt-3 text-slate-600">
          Pricing is a placeholder for now — the free tier is fully functional.
        </p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
              p.highlight ? "border-emerald-500 ring-1 ring-emerald-500" : "border-slate-200"
            }`}
          >
            <h2 className="font-semibold text-slate-900">{p.name}</h2>
            <p className="text-sm text-slate-500">{p.tagline}</p>
            <p className="mt-4 text-3xl font-bold text-slate-900">
              {p.price}
              {p.price !== "Custom" && (
                <span className="text-base font-normal text-slate-400">/mo</span>
              )}
            </p>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-slate-600">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              asChild
              className="mt-6"
              variant={p.highlight ? "default" : "outline"}
            >
              <Link href="/register">{p.cta}</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
