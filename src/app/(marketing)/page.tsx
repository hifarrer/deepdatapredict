import { DashboardClient } from "@/components/DashboardClient";
import { getSession } from "@/lib/session";

export const metadata = { title: "DeepDataPredict · Live Kalshi event predictions" };

// The landing page is the live-events dashboard. Everyone can browse events;
// generating or viewing AI predictions prompts anonymous visitors to sign in.
export default async function HomePage() {
  const session = await getSession();
  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
      <DashboardClient authenticated={!!session} />
    </div>
  );
}
