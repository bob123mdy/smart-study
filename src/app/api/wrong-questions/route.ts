import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, newId } from "@/db";
import {
  chapters,
  knowledgePoints,
  subjects,
  wrongQuestions,
  wrongErrorType,
  wrongSource,
  wrongStatus,
  type WrongErrorType,
  type WrongSource,
  type WrongStatus,
} from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

function parseTags(s: string | null): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

// 错题列表（附科目名 / 知识点名，tags 解析为数组）
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const rows = await db
    .select()
    .from(wrongQuestions)
    .where(eq(wrongQuestions.userId, userId))
    .orderBy(desc(wrongQuestions.createdAt))
    .all();

  const subName = new Map(
    (await db.select().from(subjects).where(eq(subjects.userId, userId)).all()).map((s) => [s.id, s.name]),
  );
  const kpName = new Map(
    (await db
      .select({ id: knowledgePoints.id, name: knowledgePoints.name })
      .from(knowledgePoints)
      .innerJoin(chapters, eq(knowledgePoints.chapterId, chapters.id))
      .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
      .where(eq(subjects.userId, userId))
      .all())
      .map((k) => [k.id, k.name]),
  );

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      tags: parseTags(r.tags),
      subjectName: r.subjectId ? subName.get(r.subjectId) ?? null : null,
      knowledgePointName: r.knowledgePointId ? kpName.get(r.knowledgePointId) ?? null : null,
    })),
  );
}

// 新增错题
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const question = String(body?.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "题干不能为空" }, { status: 400 });

  const errorType: WrongErrorType = (wrongErrorType as readonly string[]).includes(body?.errorType)
    ? (body.errorType as WrongErrorType)
    : "concept";
  const source: WrongSource = (wrongSource as readonly string[]).includes(body?.source)
    ? (body.source as WrongSource)
    : "manual";
  const status: WrongStatus = (wrongStatus as readonly string[]).includes(body?.status)
    ? (body.status as WrongStatus)
    : "unreviewed";
  const tags = Array.isArray(body?.tags)
    ? body.tags.map(String).map((t: string) => t.trim()).filter(Boolean)
    : [];

  const row = {
    id: newId(),
    userId,
    subjectId: body?.subjectId ? String(body.subjectId) : null,
    knowledgePointId: body?.knowledgePointId ? String(body.knowledgePointId) : null,
    question,
    answer: body?.answer ? String(body.answer).trim() : null,
    errorReason: body?.errorReason ? String(body.errorReason).trim() : null,
    errorType,
    source,
    tags: JSON.stringify(tags),
    status,
  };
  await db.insert(wrongQuestions).values(row).run();
  return NextResponse.json({ ...row, tags }, { status: 201 });
}
