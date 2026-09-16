import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chapters, subjects } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 校验章节归属当前用户（章节无 user_id，通过 subject 关联）
async function ownsChapter(userId: string, chapterId: string) {
  return await db
    .select({ id: chapters.id })
    .from(chapters)
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .where(and(eq(chapters.id, chapterId), eq(subjects.userId, userId)))
    .get();
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await ownsChapter(userId, params.id);
  if (!existing) return NextResponse.json({ error: "章节不存在" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body?.name !== undefined) patch.name = String(body.name).trim();
  if (body?.description !== undefined) patch.description = body.description ? String(body.description) : null;

  await db.update(chapters).set(patch).where(eq(chapters.id, params.id)).run();
  return NextResponse.json(await db.select().from(chapters).where(eq(chapters.id, params.id)).get());
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await ownsChapter(userId, params.id);
  if (!existing) return NextResponse.json({ error: "章节不存在" }, { status: 404 });

  await db.delete(chapters).where(eq(chapters.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
