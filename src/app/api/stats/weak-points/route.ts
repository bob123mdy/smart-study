import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getWeakPoints } from "@/lib/insights";

export const dynamic = "force-dynamic";

// 薄弱知识点诊断（基于 FSRS 记忆状态，Top 3）
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  return NextResponse.json({ weakPoints: await getWeakPoints(userId) });
}
