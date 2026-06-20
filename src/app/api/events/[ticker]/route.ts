import { NextResponse } from "next/server";
import { getEvent } from "@/lib/kalshi/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  try {
    const event = await getEvent(ticker);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ event });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load event";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
