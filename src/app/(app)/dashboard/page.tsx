import { DashboardClient } from "@/components/DashboardClient";
import { getSession } from "@/lib/session";

export const metadata = { title: "Dashboard · DeepDataPredict" };

export default async function DashboardPage() {
  const session = await getSession();
  return <DashboardClient authenticated={!!session} />;
}
