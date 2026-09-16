import { NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { goals, tasks } from "@/db/schema";
import { decomposeGoal, saveDecomposition } from "@/lib/decompose";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 模板拆解：把目标对应的科目章节/知识点展开为里程碑与每日任务（无 AI 兜底）
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const goal = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, params.id), eq(goals.userId, userId)))
    .get();
  if (!goal) return NextResponse.json({ error: "目标不存在" }, { status: 404 });
  if (!goal.subjectId || !goal.startDate || !goal.targetDate) {
    return NextResponse.json(
      { error: "该目标缺少科目或起止日期，无法拆解" },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ c: count() })
    .from(tasks)
    .where(eq(tasks.goalId, goal.id))
    .all();
  if (existing && existing.c > 0) {
    return NextResponse.json({ error: "该目标已拆解过，请先清理现有任务" }, { status: 409 });
  }

  const result = await decomposeGoal(goal.subjectId, goal.startDate, goal.targetDate);
  const { milestoneCount, taskCount } = await saveDecomposition(userId, goal.id, result);

  return NextResponse.json({ milestones: milestoneCount, tasks: taskCount });
}
