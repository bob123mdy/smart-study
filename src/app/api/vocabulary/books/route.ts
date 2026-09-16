import { NextResponse } from "next/server";
import { asc, count, eq, isNull, or } from "drizzle-orm";
import { db, newId } from "@/db";
import { wordbooks, words } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 词库列表：内置词库（user_id 为空，全局共享）+ 当前用户的自定义词库
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const books = await db
    .select()
    .from(wordbooks)
    .where(or(isNull(wordbooks.userId), eq(wordbooks.userId, userId)))
    .orderBy(asc(wordbooks.sortOrder), asc(wordbooks.createdAt))
    .all();

  const counts = await db
    .select({ wordbookId: words.wordbookId, c: count() })
    .from(words)
    .groupBy(words.wordbookId)
    .all();
  const countMap = new Map(counts.map((r) => [r.wordbookId, r.c]));

  return NextResponse.json(books.map((b) => ({ ...b, wordCount: countMap.get(b.id) ?? 0 })));
}

// 新建自定义词库
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "词库名称不能为空" }, { status: 400 });

  const row = {
    id: newId(),
    userId,
    name,
    description: body?.description ? String(body.description) : null,
    isBuiltin: false,
    source: "custom",
    sortOrder: 0,
  };
  await db.insert(wordbooks).values(row).run();
  return NextResponse.json({ ...row, wordCount: 0 }, { status: 201 });
}
