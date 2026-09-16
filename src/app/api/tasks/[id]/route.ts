import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { knowledgePoints, tasks } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 更新任务状态（完成/待办/跳过）
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, params.id), eq(tasks.userId, userId)))
    .get();
  if (!existing) return NextResponse.json({ error: "任务不存在" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body?.title !== undefined) patch.title = String(body.title).trim();
  if (body?.scheduledDate !== undefined)
    patch.scheduledDate = body.scheduledDate ? String(body.scheduledDate) : null;
  if (body?.status !== undefined) {
    const status = String(body.status);
    patch.status = status;
    patch.doneAt = status === "done" ? new Date() : null;

    // 完成任务时，若关联知识点仍未开始，联动推进为「学习中」
    if (status === "done" && existing.knowledgePointId) {
      const kp = await db
        .select()
        .from(knowledgePoints)
        .where(eq(knowledgePoints.id, existing.knowledgePointId))
        .get();
      if (kp && kp.status === "not_started") {
        await db.update(knowledgePoints)
          .set({ status: "learning", mastery: 0.5, lastReviewedAt: new Date(), updatedAt: new Date() })
          .where(eq(knowledgePoints.id, kp.id))
          .run();
      }
    }
  }

  await db.update(tasks).set(patch).where(eq(tasks.id, params.id)).run();
  return NextResponse.json(await db.select().from(tasks).where(eq(tasks.id, params.id)).get());
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, params.id), eq(tasks.userId, userId)))
    .get();
  if (!existing) return NextResponse.json({ error: "任务不存在" }, { status: 404 });

  await db.delete(tasks).where(eq(tasks.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
