import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, newId } from "@/db";
import { chapters, knowledgePoints, subjects } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 在章节下新建知识点
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const chapterId = (body?.chapterId ?? "").toString();
  const name = (body?.name ?? "").toString().trim();
  if (!chapterId || !name)
    return NextResponse.json({ error: "缺少 chapterId 或知识点名称" }, { status: 400 });

  // 校验章节归属当前用户
  const ch = await db
    .select({ id: chapters.id })
    .from(chapters)
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .where(and(eq(chapters.id, chapterId), eq(subjects.userId, userId)))
    .get();
  if (!ch) return NextResponse.json({ error: "章节不存在" }, { status: 404 });

  const row = {
    id: newId(),
    chapterId,
    name,
    description: body?.description ? String(body.description) : null,
    status: "not_started" as const,
    mastery: 0,
    difficulty: body?.difficulty ? Number(body.difficulty) : 3,
  };
  await db.insert(knowledgePoints).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
