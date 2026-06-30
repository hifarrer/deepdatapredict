import { EasyPredictionsClient } from "@/components/EasyPredictionsClient";
import { getSession } from "@/lib/session";

export const metadata = { title: "Easy Predictions · DeepDataPredict" };

export default async function EasyPredictionsPage() {
  const session = await getSession();
  return <EasyPredictionsClient authenticated={!!session} />;
}
