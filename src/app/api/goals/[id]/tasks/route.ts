import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, newId } from "@/db";
import { goals, tasks } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 手动新增每日任务
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
  if (!title) return NextResponse.json({ error: "任务标题不能为空" }, { status: 400 });

  const row = {
    id: newId(),
    userId,
    goalId: goal.id,
    milestoneId: body?.milestoneId ? String(body.milestoneId) : null,
    knowledgePointId: body?.knowledgePointId ? String(body.knowledgePointId) : null,
    title,
    type: body?.type ? String(body.type) : "study",
    scheduledDate: body?.scheduledDate ? String(body.scheduledDate) : null,
    estimatedMinutes: body?.estimatedMinutes ? Number(body.estimatedMinutes) : 30,
    status: "todo" as const,
  };
  await db.insert(tasks).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
