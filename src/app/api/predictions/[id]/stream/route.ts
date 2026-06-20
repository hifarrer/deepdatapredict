import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { PREDICTION_MODEL } from "@/lib/env";
import { runPrediction } from "@/lib/ai/predict";
import { uniquePredictionSlug } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const pred = await prisma.prediction.findUnique({ where: { id } });
  if (!pred || pred.userId !== session.sub) {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        // Already finished — replay the saved result.
        if (pred.status === "COMPLETE" && pred.result) {
          send({ type: "complete", stage: "done", progress: 100, predictionId: id, result: pred.result });
          controller.close();
          return;
        }

        let lastWrite = 0;
        for await (const ev of runPrediction(pred.eventTicker)) {
          if (ev.type === "progress") {
            send(ev);
            const now = Date.now();
            if (now - lastWrite > 1500) {
              lastWrite = now;
              await prisma.prediction
                .update({ where: { id }, data: { stage: ev.stage, progress: ev.progress } })
                .catch(() => {});
            }
          } else if (ev.type === "complete") {
            const slug =
              pred.slug ?? (await uniquePredictionSlug(ev.snapshot.event.title, id));
            await prisma.prediction.update({
              where: { id },
              data: {
                status: "COMPLETE",
                stage: "done",
                progress: 100,
                slug,
                result: ev.result as unknown as Prisma.InputJsonValue,
                kalshiSnapshot: ev.snapshot as unknown as Prisma.InputJsonValue,
                eventTitle: ev.snapshot.event.title,
                category: ev.snapshot.event.category,
                modelUsed: PREDICTION_MODEL,
                completedAt: new Date(),
              },
            });
            send({ type: "complete", stage: "done", progress: 100, predictionId: id, result: ev.result });
          } else if (ev.type === "error") {
            await prisma.prediction
              .update({ where: { id }, data: { status: "ERROR", stage: "error", error: ev.message } })
              .catch(() => {});
            send({ type: "error", message: ev.message });
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Prediction failed";
        await prisma.prediction
          .update({ where: { id }, data: { status: "ERROR", stage: "error", error: message } })
          .catch(() => {});
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
