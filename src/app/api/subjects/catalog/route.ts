import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subjects } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { persistSubjectStructure } from "@/lib/curriculum";
import { OPEN_TEXTBOOKS } from "@/lib/open-textbooks";

export const dynamic = "force-dynamic";

// 从内置开放教材目录导入整本教材（科目 → 章节 → 知识点），纯离线、无 AI 依赖。
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = (body?.id ?? "").toString().trim();
  const book = OPEN_TEXTBOOKS.find((b) => b.id === id);
  if (!book) return NextResponse.json({ ok: false, reason: "目录中未找到该教材" });

  // 避免重复导入同名教材
  const existing = await db
    .select({ name: subjects.name })
    .from(subjects)
    .where(eq(subjects.userId, userId))
    .all();
  if (existing.some((s) => s.name === book.subjectName)) {
    return NextResponse.json({ ok: false, reason: `「${book.subjectName}」已在你的科目列表中` });
  }

  try {
    const { subjectId, chapterCount, knowledgePointCount } = await persistSubjectStructure(userId, book);
    return NextResponse.json({
      ok: true,
      subjectId,
      subjectName: book.subjectName,
      chapterCount,
      knowledgePointCount,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: e instanceof Error ? e.message : "导入失败，请重试" });
  }
}
