import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 文档详情
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const row = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, params.id), eq(documents.userId, userId)))
    .get();
  if (!row) return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  return NextResponse.json(row);
}

// 删除文档（级联删除其切块）
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, params.id), eq(documents.userId, userId)))
    .get();
  if (!existing) return NextResponse.json({ error: "文档不存在" }, { status: 404 });

  await db.delete(documents).where(eq(documents.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
