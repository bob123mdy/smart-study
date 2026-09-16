import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { teacherPersonas } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 老师人格列表（当前登录用户的老师）
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const rows = await db
    .select()
    .from(teacherPersonas)
    .where(eq(teacherPersonas.userId, userId))
    .orderBy(asc(teacherPersonas.name))
    .all();
  return NextResponse.json(rows);
}
