import { addDays, differenceInDays, format, parseISO } from "date-fns";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { chapters, knowledgePoints, milestones, tasks } from "../db/schema";

export interface DecomposeMilestone {
  id: string;
  title: string;
  description?: string;
  sortOrder: number;
  targetDate: string;
}

export interface DecomposeTask {
  id: string;
  title: string;
  type: "study";
  scheduledDate: string;
  estimatedMinutes: number;
  knowledgePointId: string | null;
  milestoneId: string;
}

export interface DecomposeResult {
  milestones: DecomposeMilestone[];
  tasks: DecomposeTask[];
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * 无 AI 兜底的目标拆解：把「科目 → 章节 → 知识点」模板展开为里程碑与每日任务。
 * 每个章节 = 一个里程碑；每个知识点 = 一条学习任务，按时间均匀排布。
 */
export async function decomposeGoal(
  subjectId: string,
  startDate: string,
  targetDate: string,
): Promise<DecomposeResult> {
  const chs = await db
    .select()
    .from(chapters)
    .where(eq(chapters.subjectId, subjectId))
    .orderBy(asc(chapters.sortOrder), asc(chapters.name))
    .all();

  let days = differenceInDays(parseISO(targetDate), parseISO(startDate));
  if (days < 1) days = 90;

  const milestones: DecomposeMilestone[] = chs.map((c, i) => ({
    id: crypto.randomUUID(),
    title: `掌握第 ${i + 1} 章「${c.name}」`,
    description: c.description ?? undefined,
    sortOrder: i + 1,
    targetDate: fmt(addDays(parseISO(startDate), Math.round(((i + 1) / Math.max(chs.length, 1)) * days))),
  }));

  const kpRows = chs.length
    ? await db
        .select()
        .from(knowledgePoints)
        .where(inArray(knowledgePoints.chapterId, chs.map((c) => c.id)))
        .all()
    : [];

  const kpsByChapter = new Map<string, typeof kpRows>();
  for (const kp of kpRows) {
    const arr = kpsByChapter.get(kp.chapterId) ?? [];
    arr.push(kp);
    kpsByChapter.set(kp.chapterId, arr);
  }

  const chapterIndex = new Map(chs.map((c, i) => [c.id, i]));
  const flat = chs.flatMap((c) =>
    (kpsByChapter.get(c.id) ?? []).map((kp) => ({ kp, chapterIdx: chapterIndex.get(c.id)! })),
  );

  const tasks: DecomposeTask[] = flat.map(({ kp, chapterIdx }, j) => ({
    id: crypto.randomUUID(),
    title: `学习「${kp.name}」`,
    type: "study" as const,
    scheduledDate: fmt(
      addDays(parseISO(startDate), Math.round(((j + 1) / Math.max(flat.length, 1)) * days)),
    ),
    estimatedMinutes: 30,
    knowledgePointId: kp.id,
    milestoneId: milestones[chapterIdx].id,
  }));

  return { milestones, tasks };
}

/** 把拆解结果（里程碑 + 任务）写入数据库。供模板拆解与 AI 生成两条链路复用。 */
export async function saveDecomposition(
  userId: string,
  goalId: string,
  result: DecomposeResult,
): Promise<{ milestoneCount: number; taskCount: number }> {
  if (result.milestones.length) {
    await db
      .insert(milestones)
      .values(
        result.milestones.map((m) => ({
          id: m.id,
          goalId,
          title: m.title,
          description: m.description ?? null,
          sortOrder: m.sortOrder,
          targetDate: m.targetDate,
          status: "pending" as const,
        })),
      )
      .run();
  }
  if (result.tasks.length) {
    await db
      .insert(tasks)
      .values(
        result.tasks.map((t) => ({
          id: t.id,
          userId,
          goalId,
          milestoneId: t.milestoneId,
          knowledgePointId: t.knowledgePointId,
          title: t.title,
          type: t.type,
          scheduledDate: t.scheduledDate,
          estimatedMinutes: t.estimatedMinutes,
          status: "todo" as const,
        })),
      )
      .run();
  }
  return { milestoneCount: result.milestones.length, taskCount: result.tasks.length };
}
