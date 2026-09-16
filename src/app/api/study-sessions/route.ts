import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, newId } from "@/db";
import { studySessions, subjects } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const sessions = await db
    .select()
    .from(studySessions)
    .where(eq(studySessions.userId, userId))
    .orderBy(desc(studySessions.startedAt))
    .limit(100)
    .all();

  const subs = await db.select().from(subjects).where(eq(subjects.userId, userId)).all();
  const subjectName = new Map(subs.map((s) => [s.id, s.name]));

  return NextResponse.json(
    sessions.map((s) => ({
      ...s,
      subjectName: s.subjectId ? subjectName.get(s.subjectId) ?? null : null,
    })),
  );
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const durationMinutes = Number(body?.durationMinutes ?? 0);

  if (!(durationMinutes > 0)) {
    return NextResponse.json({ error: "学习时长必须大于 0 分钟" }, { status: 400 });
  }

  const endedAt = body?.endedAt ? new Date(String(body.endedAt)) : new Date();
  const startedAt = body?.startedAt
    ? new Date(String(body.startedAt))
    : new Date(endedAt.getTime() - durationMinutes * 60_000);

  const row = {
    id: newId(),
    userId,
    subjectId: body?.subjectId ? String(body.subjectId) : null,
    knowledgePointId: body?.knowledgePointId ? String(body.knowledgePointId) : null,
    startedAt,
    endedAt,
    durationMinutes,
    note: body?.note ? String(body.note) : null,
  };
  await db.insert(studySessions).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
