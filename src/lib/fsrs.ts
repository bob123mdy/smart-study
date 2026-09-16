// FSRS（Free Spaced Repetition Scheduler）间隔重复算法封装。
// 基于 ts-fsrs（Anki 23.10+ 同源实现），替代旧 SM-2，约减少 15-20% 复习量。
// 仅服务端使用（review.ts / vocabulary review route）；客户端组件请勿引入（会打包 ts-fsrs）。

import { fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";

// enable_short_term=false：跳过「分钟/小时级」学习步进，直接按天排期（契合知识点/错题/单词的每日复习场景）。
// enable_fuzz 保持默认 false：排期确定、可预测。
// 按目标保留率缓存调度器实例（保留率仅 85/90/95 三档，缓存避免每次新建）。
const schedulers = new Map<number, ReturnType<typeof fsrs>>();
function getScheduler(requestRetention: number) {
  let s = schedulers.get(requestRetention);
  if (!s) {
    s = fsrs({ enable_short_term: false, request_retention: requestRetention });
    schedulers.set(requestRetention, s);
  }
  return s;
}

/** 复习前卡片状态（从 DB 行抽取；新卡或缺省视为全新） */
export interface FsrsInput {
  fsrsStability?: number | null;
  fsrsDifficulty?: number | null;
  fsrsState?: number | null;
  fsrsLapses?: number | null;
  repetitions?: number;
  intervalDays?: number;
  lastReviewedAt?: Date | null;
  nextReviewAt?: Date | null;
}

/** 复习后卡片状态（写回 DB） */
export interface FsrsResult {
  fsrsStability: number;
  fsrsDifficulty: number;
  fsrsState: number;
  fsrsLapses: number;
  repetitions: number;
  intervalDays: number;
  nextReviewAt: Date;
}

/** 应用层质量分（REVIEW_GRADES.value：1/3/4/5）→ FSRS 四档评分（1=Again 2=Hard 3=Good 4=Easy） */
export function qualityToGrade(quality: number): Grade {
  if (quality >= 5) return Rating.Easy;
  if (quality >= 4) return Rating.Good;
  if (quality >= 3) return Rating.Hard;
  return Rating.Again; // ≤2 → 记错（重来）
}

/** 提交一次复习：输入旧状态 + 质量分，输出 FSRS 计算后的新状态 */
export function scheduleFsrs(
  prev: FsrsInput,
  quality: number,
  now: Date = new Date(),
  requestRetention = 0.9,
): FsrsResult {
  const grade = qualityToGrade(quality);
  const card: Card = {
    due: prev.nextReviewAt ?? now,
    stability: prev.fsrsStability ?? 0,
    difficulty: prev.fsrsDifficulty ?? 0,
    elapsed_days: 0, // 由 ts-fsrs 在 init() 中按 last_review 重新计算
    scheduled_days: prev.intervalDays ?? 0,
    learning_steps: 0, // 关闭 short-term 后恒为 0
    reps: prev.repetitions ?? 0,
    lapses: prev.fsrsLapses ?? 0,
    state: (prev.fsrsState ?? State.New) as State,
    last_review: prev.lastReviewedAt ?? undefined,
  };
  const next = getScheduler(requestRetention).next(card, now, grade).card;
  return {
    fsrsStability: next.stability,
    fsrsDifficulty: next.difficulty,
    fsrsState: next.state,
    fsrsLapses: next.lapses,
    repetitions: next.reps,
    intervalDays: next.scheduled_days,
    nextReviewAt: next.due,
  };
}
