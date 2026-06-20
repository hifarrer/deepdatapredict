import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const prediction = await prisma.prediction.findUnique({ where: { id } });
  // Owners can always view their own prediction; everyone else can view it for
  // free only once it has COMPLETEd (shared to avoid re-generating).
  const canView =
    prediction &&
    (prediction.userId === session.sub || prediction.status === "COMPLETE");
  if (!canView) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ prediction });
}
