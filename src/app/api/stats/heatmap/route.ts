import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { studySessions } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { eachDayOfInterval, format, startOfWeek, subWeeks } from "date-fns";

export const dynamic = "force-dynamic";

// 学习热力图：返回 [start, today] 内每天的累计学习分钟数
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const weeks = Number(req.nextUrl.searchParams.get("weeks") ?? 15);
  const sessions = await db
    .select()
    .from(studySessions)
    .where(eq(studySessions.userId, userId))
    .all();

  const minutesMap: Record<string, number> = {};
  for (const s of sessions) {
    const key = format(s.startedAt, "yyyy-MM-dd");
    minutesMap[key] = (minutesMap[key] ?? 0) + s.durationMinutes;
  }

  const end = new Date();
  const start = subWeeks(startOfWeek(end, { weekStartsOn: 1 }), weeks - 1);
  const days = eachDayOfInterval({ start, end });

  return NextResponse.json(
    days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      return { date: key, minutes: minutesMap[key] ?? 0 };
    }),
  );
}
