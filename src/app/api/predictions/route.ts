import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ensureMonthlyCredits, chargeOneCredit } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const predictions = await prisma.prediction.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ predictions });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const eventTicker = String(body.eventTicker ?? "").trim();
  if (!eventTicker) {
    return NextResponse.json({ error: "eventTicker is required" }, { status: 400 });
  }

  // Each prediction costs 1 credit. Refill to the plan quota at the start of
  // the month, then atomically charge — blocking the run if the user is empty.
  await ensureMonthlyCredits(session.sub);
  const charged = await chargeOneCredit(session.sub);
  if (!charged) {
    return NextResponse.json({ error: "out_of_credits" }, { status: 402 });
  }

  const prediction = await prisma.prediction.create({
    data: {
      userId: session.sub,
      eventTicker,
      eventTitle: String(body.eventTitle ?? eventTicker),
      category: body.category ? String(body.category) : null,
      status: "RUNNING",
      stage: "queued",
      progress: 2,
    },
  });

  return NextResponse.json({ id: prediction.id });
}
