import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, newId } from "@/db";
import { memories, memoryCategory, type MemoryCategory } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 记忆列表（含已归档，按类别与时间排序）
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const rows = await db
    .select()
    .from(memories)
    .where(eq(memories.userId, userId))
    .orderBy(asc(memories.category), asc(memories.createdAt))
    .all();
  return NextResponse.json(rows);
}

// 新增记忆
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const content = String(body?.content ?? "").trim();
  const rawCategory = String(body?.category ?? "preference");
  const category: MemoryCategory = (memoryCategory as readonly string[]).includes(rawCategory)
    ? (rawCategory as MemoryCategory)
    : "preference";

  if (!content) {
    return NextResponse.json({ error: "记忆内容不能为空" }, { status: 400 });
  }

  const row = {
    id: newId(),
    userId,
    category,
    content,
    importance: Number(body?.importance ?? 0.5),
    source: "manual",
  };
  await db.insert(memories).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
