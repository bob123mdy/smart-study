import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { goals, milestones } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 校验里程碑归属当前用户（里程碑无 user_id，通过 goal 关联）
async function ownsMilestone(userId: string, milestoneId: string) {
  return await db
    .select({ id: milestones.id })
    .from(milestones)
    .innerJoin(goals, eq(milestones.goalId, goals.id))
    .where(and(eq(milestones.id, milestoneId), eq(goals.userId, userId)))
    .get();
}

// 更新里程碑状态
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await ownsMilestone(userId, params.id);
  if (!existing) return NextResponse.json({ error: "里程碑不存在" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body?.title !== undefined) patch.title = String(body.title).trim();
  if (body?.targetDate !== undefined) patch.targetDate = body.targetDate ? String(body.targetDate) : null;
  if (body?.status !== undefined) {
    const status = String(body.status);
    patch.status = status;
    patch.doneAt = status === "done" ? new Date() : null;
  }

  await db.update(milestones).set(patch).where(eq(milestones.id, params.id)).run();
  return NextResponse.json(await db.select().from(milestones).where(eq(milestones.id, params.id)).get());
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await ownsMilestone(userId, params.id);
  if (!existing) return NextResponse.json({ error: "里程碑不存在" }, { status: 404 });

  await db.delete(milestones).where(eq(milestones.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
