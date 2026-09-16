import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db, newId } from "@/db";
import { conversations, conversationMode, teacherPersonas, type ConversationMode } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 会话列表（含老师名），按最近活跃排序
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      mode: conversations.mode,
      teacherPersonaId: conversations.teacherPersonaId,
      teacherName: teacherPersonas.name,
      teacherType: teacherPersonas.type,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .leftJoin(teacherPersonas, eq(conversations.teacherPersonaId, teacherPersonas.id))
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(50)
    .all();
  return NextResponse.json(rows);
}

// 新建空会话
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const teacherPersonaId = body?.teacherPersonaId ? String(body.teacherPersonaId) : null;
  if (teacherPersonaId) {
    const t = await db
      .select()
      .from(teacherPersonas)
      .where(and(eq(teacherPersonas.id, teacherPersonaId), eq(teacherPersonas.userId, userId)))
      .get();
    if (!t) return NextResponse.json({ error: "老师不存在" }, { status: 404 });
  }

  const rawMode = String(body?.mode ?? "explain");
  const mode: ConversationMode = (conversationMode as readonly string[]).includes(rawMode)
    ? (rawMode as ConversationMode)
    : "explain";
  const id = newId();
  await db.insert(conversations)
    .values({
      id,
      userId,
      teacherPersonaId,
      mode,
      title: "新对话",
    })
    .run();
  return NextResponse.json({ id }, { status: 201 });
}
