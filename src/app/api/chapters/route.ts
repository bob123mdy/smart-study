import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db, newId } from "@/db";
import { chapters, subjects } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 在科目下新建章节
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const subjectId = (body?.subjectId ?? "").toString();
  const name = (body?.name ?? "").toString().trim();
  if (!subjectId || !name)
    return NextResponse.json({ error: "缺少 subjectId 或章节名称" }, { status: 400 });

  const subj = await db
    .select()
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
    .get();
  if (!subj) return NextResponse.json({ error: "科目不存在" }, { status: 404 });

  const maxSort = (
    await db
      .select({ m: chapters.sortOrder })
      .from(chapters)
      .where(eq(chapters.subjectId, subjectId))
      .all()
  ).reduce((mx, r) => Math.max(mx, r.m), 0);

  const row = {
    id: newId(),
    subjectId,
    name,
    description: body?.description ? String(body.description) : null,
    sortOrder: maxSort + 1,
  };
  await db.insert(chapters).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
