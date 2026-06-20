import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Sign in · DeepDataPredict" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="text-sm text-slate-500">Sign in to generate predictions.</p>
      </div>
      <AuthForm mode="login" next={next} />
    </div>
  );
}
