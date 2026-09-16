import { NextResponse } from "next/server";
import { getReviewLogs } from "@/lib/review";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  return NextResponse.json(await getReviewLogs(userId));
}
