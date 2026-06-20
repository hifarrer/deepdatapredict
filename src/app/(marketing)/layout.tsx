import { SiteHeader } from "@/components/SiteHeader";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-400">
        DeepDataPredict · AI estimations are informational only and do not guarantee results.
      </footer>
    </div>
  );
}
