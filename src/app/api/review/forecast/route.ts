import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getForecast } from "@/lib/review";

export const dynamic = "force-dynamic";

// 未来 7 天复习量预测（知识点 + 错题）
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  return NextResponse.json(await getForecast(userId));
}
