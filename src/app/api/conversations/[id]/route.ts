import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 会话详情（含全部消息）
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const conv = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, params.id), eq(conversations.userId, userId)))
    .get();
  if (!conv) return NextResponse.json({ error: "会话不存在" }, { status: 404 });

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.id))
    .orderBy(asc(messages.createdAt))
    .all();
  return NextResponse.json({ ...conv, messages: msgs });
}

// 删除会话（级联删除其消息）
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const conv = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, params.id), eq(conversations.userId, userId)))
    .get();
  if (!conv) return NextResponse.json({ error: "会话不存在" }, { status: 404 });

  await db.delete(conversations).where(eq(conversations.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
