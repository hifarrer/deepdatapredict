export const metadata = { title: "How it works · DeepDataPredict" };

const steps = [
  {
    title: "1 · Browse live events",
    body: "We pull events that are currently open and tradeable on Kalshi, sorted by trading volume and filterable by category.",
  },
  {
    title: "2 · Generate a prediction",
    body: "Click Generate prediction on any event. We capture the live Kalshi prices and price history, then hand it to Claude.",
  },
  {
    title: "3 · Deep AI research",
    body: "Claude researches the web — team records, head-to-head history, price trends, polls, news — weighing it against the market's implied probability, accounting for how much time is left until the market closes.",
  },
  {
    title: "4 · Your result, saved",
    body: "You get a probability estimate, a confidence level, the key factors, charts and sources. Every prediction is saved to your account.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">How it works</h1>
      <p className="mt-3 text-slate-600">
        DeepDataPredict turns live Kalshi markets into a deep, explainable AI
        forecast.
      </p>
      <div className="mt-10 space-y-6">
        {steps.map((s) => (
          <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">{s.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{s.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-10 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Predictions are AI estimations and do not guarantee results. DeepDataPredict
        is informational only and does not place trades.
      </p>
    </div>
  );
}
