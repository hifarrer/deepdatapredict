import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Create account · DeepDataPredict" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="text-sm text-slate-500">
          Start generating AI-powered predictions.
        </p>
      </div>
      <AuthForm mode="register" next={next} />
    </div>
  );
}
