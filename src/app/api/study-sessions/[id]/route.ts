import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { studySessions } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await db
    .select()
    .from(studySessions)
    .where(and(eq(studySessions.id, params.id), eq(studySessions.userId, userId)))
    .get();
  if (!existing) return NextResponse.json({ error: "学习记录不存在" }, { status: 404 });

  await db.delete(studySessions).where(eq(studySessions.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
