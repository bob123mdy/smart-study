import { NextResponse } from "next/server";
import { asc, eq, inArray } from "drizzle-orm";
import { db, newId } from "@/db";
import { chapters, knowledgePoints, subjects } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 返回完整三级树：科目 → 章节 → 知识点
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const subs = await db
    .select()
    .from(subjects)
    .where(eq(subjects.userId, userId))
    .orderBy(asc(subjects.sortOrder), asc(subjects.name))
    .all();
  const subIds = subs.map((s) => s.id);
  const chs = subIds.length
    ? await db
        .select()
        .from(chapters)
        .where(inArray(chapters.subjectId, subIds))
        .orderBy(asc(chapters.sortOrder), asc(chapters.name))
        .all()
    : [];
  const chIds = chs.map((c) => c.id);
  const kps = chIds.length
    ? await db
        .select()
        .from(knowledgePoints)
        .where(inArray(knowledgePoints.chapterId, chIds))
        .orderBy(asc(knowledgePoints.name))
        .all()
    : [];

  // prerequisites 以 JSON 字符串存储，这里解析为 ID 数组，便于前端解析名称/状态
  const parsePrereq = (raw: string | null): string[] => {
    if (!raw) return [];
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  };

  const tree = subs.map((s) => ({
    ...s,
    chapters: chs
      .filter((c) => c.subjectId === s.id)
      .map((c) => ({
        ...c,
        knowledgePoints: kps
          .filter((k) => k.chapterId === c.id)
          .map((k) => ({ ...k, prerequisites: parsePrereq(k.prerequisites) })),
      })),
  }));

  return NextResponse.json(tree);
}

// 新建科目
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").toString().trim();
  if (!name) return NextResponse.json({ error: "科目名称不能为空" }, { status: 400 });

  const maxSort = (
    await db
      .select({ m: subjects.sortOrder })
      .from(subjects)
      .where(eq(subjects.userId, userId))
      .all()
  ).reduce((mx, r) => Math.max(mx, r.m), 0);

  const row = {
    id: newId(),
    userId,
    name,
    description: body?.description ? String(body.description) : null,
    color: body?.color ? String(body.color) : "#6366f1",
    sortOrder: maxSort + 1,
  };
  await db.insert(subjects).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
