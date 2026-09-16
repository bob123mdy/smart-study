import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { goals, milestones, tasks } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, params.id), eq(goals.userId, userId)))
    .get();
  if (!existing) return NextResponse.json({ error: "目标不存在" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body?.title !== undefined) patch.title = String(body.title).trim();
  if (body?.description !== undefined) patch.description = body.description ? String(body.description) : null;
  if (body?.status !== undefined) patch.status = String(body.status);
  if (body?.startDate !== undefined) patch.startDate = body.startDate ? String(body.startDate) : null;
  if (body?.targetDate !== undefined) patch.targetDate = body.targetDate ? String(body.targetDate) : null;

  await db.update(goals).set(patch).where(eq(goals.id, params.id)).run();
  return NextResponse.json(await db.select().from(goals).where(eq(goals.id, params.id)).get());
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, params.id), eq(goals.userId, userId)))
    .get();
  if (!existing) return NextResponse.json({ error: "目标不存在" }, { status: 404 });

  // 先清理任务（其 goal_id 为 SET NULL），里程碑随目标级联删除
  await db.delete(tasks).where(eq(tasks.goalId, params.id)).run();
  await db.delete(milestones).where(eq(milestones.goalId, params.id)).run();
  await db.delete(goals).where(eq(goals.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
