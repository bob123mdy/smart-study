// 用户偏好设置（存 users.settings JSON 列）：FSRS 目标保留率 + 每日目标学习时长。
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export const RETENTION_OPTIONS: number[] = [0.85, 0.9, 0.95];
export const DEFAULT_RETENTION = 0.9;

export const DAILY_GOAL_OPTIONS: number[] = [15, 30, 60, 90];
export const DEFAULT_DAILY_GOAL = 30;

interface UserSettings {
  retention?: number;
  dailyGoalMinutes?: number;
}

function parse(raw: string | null): UserSettings {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as UserSettings) : {};
  } catch {
    return {};
  }
}

async function readSettings(userId: string): Promise<UserSettings> {
  const row = await db
    .select({ settings: users.settings })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  return parse(row?.settings ?? null);
}

async function writeSettings(userId: string, next: UserSettings): Promise<void> {
  await db
    .update(users)
    .set({ settings: JSON.stringify(next) })
    .where(eq(users.id, userId))
    .run();
}

/** 读取用户目标保留率（未设置/非法时回退默认 90%） */
export async function getRetention(userId: string): Promise<number> {
  const r = (await readSettings(userId)).retention;
  return typeof r === "number" && RETENTION_OPTIONS.includes(r) ? r : DEFAULT_RETENTION;
}

/** 写入目标保留率（仅接受 85/90/95）；返回是否成功 */
export async function setRetention(userId: string, retention: number): Promise<boolean> {
  if (!RETENTION_OPTIONS.includes(retention)) return false;
  await writeSettings(userId, { ...(await readSettings(userId)), retention });
  return true;
}

/** 读取每日目标学习时长（分钟，默认 30） */
export async function getDailyGoal(userId: string): Promise<number> {
  const m = (await readSettings(userId)).dailyGoalMinutes;
  return typeof m === "number" && DAILY_GOAL_OPTIONS.includes(m) ? m : DEFAULT_DAILY_GOAL;
}

/** 写入每日目标学习时长（仅接受 15/30/60/90 分钟）；返回是否成功 */
export async function setDailyGoal(userId: string, minutes: number): Promise<boolean> {
  if (!DAILY_GOAL_OPTIONS.includes(minutes)) return false;
  await writeSettings(userId, { ...(await readSettings(userId)), dailyGoalMinutes: minutes });
  return true;
}
