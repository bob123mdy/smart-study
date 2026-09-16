import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { subjects } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 更新科目（名称/描述/颜色/归档）
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await db
    .select()
    .from(subjects)
    .where(and(eq(subjects.id, params.id), eq(subjects.userId, userId)))
    .get();
  if (!existing) return NextResponse.json({ error: "科目不存在" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body?.name !== undefined) patch.name = String(body.name).trim();
  if (body?.description !== undefined) patch.description = body.description ? String(body.description) : null;
  if (body?.color !== undefined) patch.color = String(body.color);
  if (body?.isArchived !== undefined) patch.isArchived = Boolean(body.isArchived);

  await db.update(subjects).set(patch).where(eq(subjects.id, params.id)).run();
  const row = await db.select().from(subjects).where(eq(subjects.id, params.id)).get();
  return NextResponse.json(row);
}

// 删除科目（级联删除章节与知识点）
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await db
    .select()
    .from(subjects)
    .where(and(eq(subjects.id, params.id), eq(subjects.userId, userId)))
    .get();
  if (!existing) return NextResponse.json({ error: "科目不存在" }, { status: 404 });

  await db.delete(subjects).where(eq(subjects.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
