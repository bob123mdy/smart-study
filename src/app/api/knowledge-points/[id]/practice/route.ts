import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { generatePractice } from "@/lib/practice";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 为知识点生成一道练习题（AI 出单选题；无 AI 时降级为复述自测）
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const result = await generatePractice(userId, params.id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json(result);
}
