import { NextResponse } from "next/server";
import { reviewTargetType, type ReviewTargetType } from "@/db/schema";
import { submitReview } from "@/lib/review";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 提交复习评分（应用 FSRS 并排期）
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const targetType = String(body?.targetType ?? "");
  const targetId = String(body?.targetId ?? "");
  const quality = Number(body?.quality);

  if (!(reviewTargetType as readonly string[]).includes(targetType)) {
    return NextResponse.json({ error: "无效的目标类型" }, { status: 400 });
  }
  if (!targetId) return NextResponse.json({ error: "缺少目标 ID" }, { status: 400 });
  if (!Number.isFinite(quality) || quality < 0 || quality > 5) {
    return NextResponse.json({ error: "评分需在 0-5 之间" }, { status: 400 });
  }

  const result = await submitReview(userId, targetType as ReviewTargetType, targetId, quality);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json(result);
}
