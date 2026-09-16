import { NextResponse } from "next/server";
import { db, newId } from "@/db";
import { goals, milestones } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 手动新增里程碑
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const goal = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, params.id), eq(goals.userId, userId)))
    .get();
  if (!goal) return NextResponse.json({ error: "目标不存在" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const title = (body?.title ?? "").toString().trim();
  if (!title) return NextResponse.json({ error: "里程碑标题不能为空" }, { status: 400 });

  const maxSort = (await db
    .select({ m: milestones.sortOrder })
    .from(milestones)
    .where(eq(milestones.goalId, goal.id))
    .all()).reduce((mx, r) => Math.max(mx, r.m), 0);

  const row = {
    id: newId(),
    goalId: goal.id,
    title,
    description: body?.description ? String(body.description) : null,
    sortOrder: maxSort + 1,
    targetDate: body?.targetDate ? String(body.targetDate) : null,
    status: "pending" as const,
  };
  await db.insert(milestones).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
