import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import {
  DAILY_GOAL_OPTIONS,
  DEFAULT_DAILY_GOAL,
  DEFAULT_RETENTION,
  getDailyGoal,
  getRetention,
  RETENTION_OPTIONS,
  setDailyGoal,
  setRetention,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

// 读取用户偏好（目标保留率 + 每日目标学习时长）
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  return NextResponse.json({
    retention: await getRetention(userId),
    retentionOptions: RETENTION_OPTIONS,
    defaultRetention: DEFAULT_RETENTION,
    dailyGoalMinutes: await getDailyGoal(userId),
    dailyGoalOptions: DAILY_GOAL_OPTIONS,
    defaultDailyGoal: DEFAULT_DAILY_GOAL,
  });
}

// 更新偏好：可同时更新 retention 与 dailyGoalMinutes，均可选
export async function PUT(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};

  if (body?.retention !== undefined) {
    const retention = Number(body.retention);
    if (!Number.isFinite(retention)) return NextResponse.json({ error: "缺少保留率" }, { status: 400 });
    if (!(await setRetention(userId, retention))) {
      return NextResponse.json({ error: "保留率仅支持 85% / 90% / 95%" }, { status: 400 });
    }
    patch.retention = retention;
  }

  if (body?.dailyGoalMinutes !== undefined) {
    const minutes = Number(body.dailyGoalMinutes);
    if (!Number.isFinite(minutes)) return NextResponse.json({ error: "缺少每日目标" }, { status: 400 });
    if (!(await setDailyGoal(userId, minutes))) {
      return NextResponse.json({ error: "每日目标仅支持 15 / 30 / 60 / 90 分钟" }, { status: 400 });
    }
    patch.dailyGoalMinutes = minutes;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 });
  }
  return NextResponse.json(patch);
}
