export const metadata = { title: "FAQ · DeepDataPredict" };

const faqs = [
  {
    q: "Does DeepDataPredict place trades?",
    a: "No. It is an information and analysis tool only. It never places orders or moves money — it just estimates outcomes.",
  },
  {
    q: "Where does the data come from?",
    a: "Live market data comes from Kalshi's public API. The AI analysis additionally researches the open web for current, relevant information.",
  },
  {
    q: "How accurate are the predictions?",
    a: "They are AI estimations and carry no guarantee. Treat them as one input among many — not financial advice.",
  },
  {
    q: "Why does a prediction take a couple of minutes?",
    a: "Each prediction runs a deep analysis with multiple live web searches before producing a result. Quality over speed.",
  },
  {
    q: "Which events can I analyze?",
    a: "Any event that is currently live (open) on Kalshi. Closed and settled events are kept in your History.",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">Frequently asked questions</h1>
      <div className="mt-10 space-y-4">
        {faqs.map((f) => (
          <div key={f.q} className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">{f.q}</h2>
            <p className="mt-2 text-sm text-slate-600">{f.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
