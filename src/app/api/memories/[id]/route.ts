import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { memories } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 更新记忆（内容 / 重要度 / 归档）
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await db
    .select()
    .from(memories)
    .where(and(eq(memories.id, params.id), eq(memories.userId, userId)))
    .get();
  if (!existing) return NextResponse.json({ error: "记忆不存在" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body?.content !== undefined) patch.content = String(body.content).trim();
  if (body?.importance !== undefined) {
    const v = Number(body.importance);
    patch.importance = Math.min(1, Math.max(0, v));
  }
  if (body?.archived !== undefined) patch.archived = Boolean(body.archived);

  await db.update(memories).set(patch).where(eq(memories.id, params.id)).run();
  const row = await db.select().from(memories).where(eq(memories.id, params.id)).get();
  return NextResponse.json(row);
}

// 删除记忆
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await db
    .select()
    .from(memories)
    .where(and(eq(memories.id, params.id), eq(memories.userId, userId)))
    .get();
  if (!existing) return NextResponse.json({ error: "记忆不存在" }, { status: 404 });

  await db.delete(memories).where(eq(memories.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
