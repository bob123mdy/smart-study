import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { wordbooks } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 删除自定义词库（内置词库不可删）
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const book = await db.select().from(wordbooks).where(eq(wordbooks.id, params.id)).get();
  if (!book) return NextResponse.json({ error: "词库不存在" }, { status: 404 });
  if (book.isBuiltin) return NextResponse.json({ error: "内置词库不可删除" }, { status: 400 });
  if (book.userId !== userId) return NextResponse.json({ error: "无权操作该词库" }, { status: 403 });

  await db.delete(wordbooks).where(eq(wordbooks.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
