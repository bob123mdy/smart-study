import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, newId } from "@/db";
import { goals, milestones, tasks, type Goal } from "@/db/schema";
import { differenceInDays, format, parseISO } from "date-fns";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const todayStr = () => format(new Date(), "yyyy-MM-dd");

async function enrich(goal: Goal) {
  const ms = await db
    .select()
    .from(milestones)
    .where(eq(milestones.goalId, goal.id))
    .orderBy(milestones.sortOrder)
    .all();
  const ts = await db.select().from(tasks).where(eq(tasks.goalId, goal.id)).all();

  const total = ts.length;
  const done = ts.filter((t) => t.status === "done").length;
  const progress = total ? done / total : 0;

  let timeProgress = 0;
  if (goal.startDate && goal.targetDate) {
    const totalDays = differenceInDays(parseISO(goal.targetDate), parseISO(goal.startDate));
    const elapsed = Math.max(
      0,
      Math.min(differenceInDays(parseISO(todayStr()), parseISO(goal.startDate)), totalDays),
    );
    timeProgress = totalDays > 0 ? elapsed / totalDays : 0;
  }

  let pace: "idle" | "ahead" | "behind" | "on_track" = "idle";
  if (total > 0) {
    const diff = progress - timeProgress;
    pace = diff > 0.05 ? "ahead" : diff < -0.05 ? "behind" : "on_track";
  }

  return {
    ...goal,
    milestones: ms,
    tasks: ts,
    progress,
    doneTasks: done,
    totalTasks: total,
    timeProgress,
    pace,
  };
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const rows = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(desc(goals.createdAt))
    .all();
  return NextResponse.json(await Promise.all(rows.map(enrich)));
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const title = (body?.title ?? "").toString().trim();
  if (!title) return NextResponse.json({ error: "目标标题不能为空" }, { status: 400 });

  const row = {
    id: newId(),
    userId,
    title,
    description: body?.description ? String(body.description) : null,
    subjectId: body?.subjectId ? String(body.subjectId) : null,
    startDate: body?.startDate ? String(body.startDate) : todayStr(),
    targetDate: body?.targetDate ? String(body.targetDate) : null,
    status: "active" as const,
    progress: 0,
  };
  await db.insert(goals).values(row).run();
  return NextResponse.json(await enrich((await db.select().from(goals).where(eq(goals.id, row.id)).get())!), {
    status: 201,
  });
}
