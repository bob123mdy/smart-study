import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getNextUp } from "@/lib/next-up";

export const dynamic = "force-dynamic";

// 今日下一步：到期待复习 + 薄弱点 + 前置已解锁新知识（按优先级）
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  return NextResponse.json({ items: await getNextUp(userId) });
}
