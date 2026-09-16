// 「今日下一步」统一队列：把到期待复习、薄弱点、前置已解锁的新知识合成一个按优先级排序的清单。
// 纯本地聚合，无 AI 依赖。顺序即优先级：复习 > 薄弱 > 新学。
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chapters, knowledgePoints, subjects } from "@/db/schema";
import { getReviewQueue } from "./review";
import { getWeakPoints } from "./insights";

export type NextUpKind = "review_kp" | "review_wq" | "weak" | "ready";

export interface NextUpItem {
  kind: NextUpKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

function parsePrereq(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

// 前置已全部掌握、但自身还未开始的知识点（「解锁了，可以学了」）
async function getReadyToLearn(userId: string, limit = 3): Promise<NextUpItem[]> {
  const masteredIds = new Set(
    (
      await db
        .select({ id: knowledgePoints.id })
        .from(knowledgePoints)
        .innerJoin(chapters, eq(knowledgePoints.chapterId, chapters.id))
        .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
        .where(and(eq(subjects.userId, userId), eq(knowledgePoints.status, "mastered")))
        .all()
    ).map((r) => r.id),
  );

  const candidates = await db
    .select({
      id: knowledgePoints.id,
      name: knowledgePoints.name,
      prerequisites: knowledgePoints.prerequisites,
      subjectName: subjects.name,
      chapterName: chapters.name,
    })
    .from(knowledgePoints)
    .innerJoin(chapters, eq(knowledgePoints.chapterId, chapters.id))
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .where(and(eq(subjects.userId, userId), eq(knowledgePoints.status, "not_started")))
    .all();

  return candidates
    .filter((c) => {
      const pre = parsePrereq(c.prerequisites);
      // 只挑「设了前置、且前置已全掌握」的，避免把没设前置的所有未学知识点都铺出来
      return pre.length > 0 && pre.every((pid) => masteredIds.has(pid));
    })
    .slice(0, limit)
    .map((c) => ({
      kind: "ready" as const,
      id: c.id,
      title: c.name,
      subtitle: `可开始学 · ${c.subjectName} › ${c.chapterName}`,
      href: `/learn/teach?kp=${c.id}`,
    }));
}

export async function getNextUp(userId: string, limit = 8): Promise<NextUpItem[]> {
  const items: NextUpItem[] = [];
  const seen = new Set<string>();
  const push = (item: NextUpItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  };

  // 1. 到期待复习（各最多 2 条，避免挤占后续来源）
  const { kps, wqs } = await getReviewQueue(userId);
  for (const k of kps.slice(0, 2)) {
    push({ kind: "review_kp", id: k.id, title: k.title, subtitle: "今日待复习 · 知识点", href: "/review" });
  }
  for (const w of wqs.slice(0, 2)) {
    push({ kind: "review_wq", id: w.id, title: w.title, subtitle: "今日待复习 · 错题", href: "/review" });
  }

  // 2. 薄弱点
  for (const wp of await getWeakPoints(userId, 3)) {
    push({ kind: "weak", id: wp.id, title: wp.name, subtitle: `薄弱点 · ${wp.reason}`, href: `/learn/teach?kp=${wp.id}` });
  }

  // 3. 前置已解锁的新知识
  for (const r of await getReadyToLearn(userId, 3)) push(r);

  return items.slice(0, limit);
}
