import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

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
