import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
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

// 更新错题（部分字段）
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await db
    .select()
    .from(wrongQuestions)
    .where(and(eq(wrongQuestions.id, params.id), eq(wrongQuestions.userId, userId)))
    .get();
  if (!existing) return NextResponse.json({ error: "错题不存在" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (body?.question !== undefined) patch.question = String(body.question).trim();
  if (body?.answer !== undefined) patch.answer = body.answer ? String(body.answer).trim() : null;
  if (body?.errorReason !== undefined)
    patch.errorReason = body.errorReason ? String(body.errorReason).trim() : null;
  if (body?.subjectId !== undefined) patch.subjectId = body.subjectId ? String(body.subjectId) : null;
  if (body?.knowledgePointId !== undefined)
    patch.knowledgePointId = body.knowledgePointId ? String(body.knowledgePointId) : null;

  if (body?.errorType !== undefined) {
    const v: WrongErrorType = (wrongErrorType as readonly string[]).includes(body.errorType)
      ? (body.errorType as WrongErrorType)
      : "concept";
    patch.errorType = v;
  }
  if (body?.source !== undefined) {
    const v: WrongSource = (wrongSource as readonly string[]).includes(body.source)
      ? (body.source as WrongSource)
      : "manual";
    patch.source = v;
  }
  if (body?.status !== undefined) {
    const v: WrongStatus = (wrongStatus as readonly string[]).includes(body.status)
      ? (body.status as WrongStatus)
      : "unreviewed";
    patch.status = v;
  }
  if (body?.tags !== undefined) {
    const tags = Array.isArray(body.tags)
      ? body.tags.map(String).map((t: string) => t.trim()).filter(Boolean)
      : [];
    patch.tags = JSON.stringify(tags);
  }

  await db.update(wrongQuestions).set(patch).where(eq(wrongQuestions.id, params.id)).run();
  const row = (await db.select().from(wrongQuestions).where(eq(wrongQuestions.id, params.id)).get())!;
  return NextResponse.json({ ...row, tags: parseTags(row.tags) });
}

// 删除错题
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await db
    .select()
    .from(wrongQuestions)
    .where(and(eq(wrongQuestions.id, params.id), eq(wrongQuestions.userId, userId)))
    .get();
  if (!existing) return NextResponse.json({ error: "错题不存在" }, { status: 404 });

  await db.delete(wrongQuestions).where(eq(wrongQuestions.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
