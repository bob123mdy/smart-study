// 学习数据导出：Markdown（人类可读）/ JSON（完整原始）/ Anki TSV（错题+知识点卡片）
// 纯本地读取，无 AI 依赖，贯彻「数据主权」

import { eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  subjects,
  chapters,
  knowledgePoints,
  goals,
  milestones,
  tasks,
  studySessions,
  wrongQuestions,
  memories,
  reviewLogs,
  wordbooks,
  words,
  wordProgress,
} from "@/db/schema";
import { ERROR_TYPE_LABELS, ERROR_TYPE_EMOJI, WQ_STATUS_LABELS } from "./wrong-questions";
import { MEMORY_CATEGORY_LABELS, MEMORY_CATEGORY_EMOJI } from "./memories";

const KP_STATUS_LABELS: Record<string, string> = {
  not_started: "未开始",
  learning: "学习中",
  mastered: "已掌握",
};

function fmt(d: Date | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 19).replace("T", " ");
}

function parseTags(s: string | null): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

async function gather(userId: string) {
  const subs = await db.select().from(subjects).where(eq(subjects.userId, userId)).all();
  const subIds = subs.map((s) => s.id);
  const chs = subIds.length
    ? await db.select().from(chapters).where(inArray(chapters.subjectId, subIds)).all()
    : [];
  const chIds = chs.map((c) => c.id);
  const kps = chIds.length
    ? await db.select().from(knowledgePoints).where(inArray(knowledgePoints.chapterId, chIds)).all()
    : [];
  const goalsRows = await db.select().from(goals).where(eq(goals.userId, userId)).all();
  const goalIds = goalsRows.map((g) => g.id);

  // 背单词：内置词库（user_id 为空）共享 + 用户自定义词库
  const bookRows = await db
    .select()
    .from(wordbooks)
    .where(or(isNull(wordbooks.userId), eq(wordbooks.userId, userId)))
    .all();
  const bookIds = bookRows.map((b) => b.id);

  return {
    subjects: subs,
    chapters: chs,
    knowledgePoints: kps,
    goals: goalsRows,
    milestones: goalIds.length
      ? await db.select().from(milestones).where(inArray(milestones.goalId, goalIds)).all()
      : [],
    tasks: await db.select().from(tasks).where(eq(tasks.userId, userId)).all(),
    studySessions: await db.select().from(studySessions).where(eq(studySessions.userId, userId)).all(),
    wrongQuestions: await db.select().from(wrongQuestions).where(eq(wrongQuestions.userId, userId)).all(),
    memories: await db.select().from(memories).where(eq(memories.userId, userId)).all(),
    reviewLogs: await db.select().from(reviewLogs).where(eq(reviewLogs.userId, userId)).all(),
    wordbooks: bookRows,
    words: bookIds.length ? await db.select().from(words).where(inArray(words.wordbookId, bookIds)).all() : [],
    wordProgress: await db.select().from(wordProgress).where(eq(wordProgress.userId, userId)).all(),
    exportedAt: new Date(),
  };
}

// ---- JSON：完整原始数据 ----
export async function exportJson(userId: string) {
  return gather(userId);
}

// ---- Markdown：人类可读 ----
export async function exportMarkdown(userId: string): Promise<string> {
  const d = await gather(userId);
  const L: string[] = [];
  const subName = new Map(d.subjects.map((s) => [s.id, s.name]));

  L.push("# 个人智能学习系统 · 数据导出");
  L.push("");
  L.push(`> 导出时间：${fmt(d.exportedAt)}`);
  L.push("");

  // 概览
  const totalMinutes = d.studySessions.reduce((n, s) => n + s.durationMinutes, 0);
  L.push("## 概览");
  L.push("");
  L.push(
    `- 科目 ${d.subjects.length} · 章节 ${d.chapters.length} · 知识点 ${d.knowledgePoints.length}`,
  );
  L.push(`- 目标 ${d.goals.length} · 错题 ${d.wrongQuestions.length} · 记忆 ${d.memories.length}`);
  L.push(`- 学习记录 ${d.studySessions.length} 条 · 累计 ${totalMinutes} 分钟`);
  L.push("");

  // 科目与知识点
  L.push("## 科目与知识点");
  L.push("");
  for (const s of d.subjects) {
    L.push(`### ${s.name}`);
    if (s.description) L.push(`_${s.description}_`);
    for (const c of d.chapters.filter((c) => c.subjectId === s.id)) {
      L.push(`#### ${c.name}`);
      for (const k of d.knowledgePoints.filter((k) => k.chapterId === c.id)) {
        const status = KP_STATUS_LABELS[k.status] ?? k.status;
        L.push(`- ${k.name}（${status}）`);
        if (k.description) L.push(`  - ${k.description}`);
      }
    }
    L.push("");
  }

  // 目标
  L.push("## 目标与计划");
  L.push("");
  if (d.goals.length === 0) L.push("_无_");
  for (const g of d.goals) {
    L.push(`### ${g.title}`);
    L.push(`- 状态：${g.status} · 进度：${Math.round(g.progress * 100)}%`);
    if (g.startDate || g.targetDate) L.push(`- 周期：${g.startDate ?? "?"} → ${g.targetDate ?? "?"}`);
    const ms = d.milestones.filter((m) => m.goalId === g.id);
    if (ms.length) {
      L.push(`- 里程碑：`);
      for (const m of ms) L.push(`  - [${m.status}] ${m.title}${m.targetDate ? `（${m.targetDate}）` : ""}`);
    }
    const ts = d.tasks.filter((t) => t.goalId === g.id);
    if (ts.length) {
      L.push(`- 任务（${ts.filter((t) => t.status === "done").length}/${ts.length} 完成）：`);
      for (const t of ts) L.push(`  - [${t.status}] ${t.title}`);
    }
    L.push("");
  }

  // 错题本
  L.push("## 错题本");
  L.push("");
  if (d.wrongQuestions.length === 0) L.push("_无_");
  for (const w of d.wrongQuestions) {
    const kpName = w.knowledgePointId
      ? d.knowledgePoints.find((k) => k.id === w.knowledgePointId)?.name
      : null;
    const subj = w.subjectId ? subName.get(w.subjectId) : null;
    L.push(`### ${ERROR_TYPE_EMOJI[w.errorType] ?? "❓"} ${w.question}`);
    if (w.answer) L.push(`- 答案：${w.answer}`);
    if (w.errorReason) L.push(`- 错因：${w.errorReason}`);
    L.push(
      `- 分类：${ERROR_TYPE_LABELS[w.errorType] ?? w.errorType} · 状态：${WQ_STATUS_LABELS[w.status] ?? w.status} · 复习 ${w.reviewCount} 次`,
    );
    const meta = [subj, kpName, ...parseTags(w.tags).map((t) => `#${t}`)].filter(Boolean);
    if (meta.length) L.push(`- 关联：${meta.join(" / ")}`);
    L.push("");
  }

  // 长期记忆
  L.push("## 长期记忆");
  L.push("");
  if (d.memories.length === 0) L.push("_无_");
  for (const m of d.memories) {
    L.push(
      `- ${MEMORY_CATEGORY_EMOJI[m.category] ?? ""} [${MEMORY_CATEGORY_LABELS[m.category] ?? m.category}] ${m.content}${m.archived ? "（已归档）" : ""}`,
    );
  }
  L.push("");

  // 学习记录
  L.push("## 学习记录");
  L.push("");
  if (d.studySessions.length === 0) L.push("_无_");
  for (const s of d.studySessions) {
    const subj = s.subjectId ? subName.get(s.subjectId) : "未关联";
    L.push(`- ${fmt(s.startedAt)} · ${subj} · ${s.durationMinutes} 分钟${s.note ? ` · ${s.note}` : ""}`);
  }
  L.push("");

  // 背单词
  const wordStatusLabel: Record<string, string> = { new: "新词", learning: "学习中", mastered: "已掌握" };
  const progByWord = new Map(d.wordProgress.map((p) => [p.wordId, p]));
  L.push("## 背单词");
  L.push("");
  if (d.wordbooks.length === 0) L.push("_无_");
  for (const b of d.wordbooks) {
    const ws = d.words.filter((w) => w.wordbookId === b.id);
    const mastered = ws.filter((w) => progByWord.get(w.id)?.status === "mastered").length;
    L.push(`### ${b.name}${b.isBuiltin ? "（内置）" : ""}`);
    L.push(`- 单词 ${ws.length} · 已掌握 ${mastered}`);
    for (const w of ws) {
      const p = progByWord.get(w.id);
      const st = p ? wordStatusLabel[p.status] ?? p.status : "新词";
      L.push(`- ${w.word}${w.phonetic ? ` ${w.phonetic}` : ""}：${w.meaning}（${st}）`);
    }
    L.push("");
  }

  return L.join("\n");
}

// ---- Anki TSV：错题 + 知识点卡片 ----
function esc(s: string): string {
  return s.replace(/\r?\n/g, "<br>").replace(/\t/g, " ");
}
function tag(s: string): string {
  return s.trim().replace(/\s+/g, "_");
}

export async function exportAnki(userId: string): Promise<string> {
  const d = await gather(userId);
  const rows: string[] = ["#separator:tab", "#html:true", "Front\tBack\tTags"];

  const subName = new Map(d.subjects.map((s) => [s.id, s.name]));
  const kpName = new Map(d.knowledgePoints.map((k) => [k.id, k.name]));
  const chSubject = new Map(d.chapters.map((c) => [c.id, c.subjectId]));

  // 错题卡片
  for (const w of d.wrongQuestions) {
    const front = esc(w.question);
    const back = esc(
      [w.answer ? `答案：${w.answer}` : "", w.errorReason ? `错因：${w.errorReason}` : ""]
        .filter(Boolean)
        .join("<br>"),
    );
    const tags = [
      ERROR_TYPE_LABELS[w.errorType] ?? w.errorType,
      w.subjectId ? subName.get(w.subjectId) : null,
      w.knowledgePointId ? kpName.get(w.knowledgePointId) : null,
      ...parseTags(w.tags),
    ]
      .filter(Boolean)
      .map((t) => tag(String(t)))
      .filter(Boolean)
      .join(" ");
    rows.push(`${front}\t${back}\t${tags}`);
  }

  // 知识点卡片
  for (const k of d.knowledgePoints) {
    const subjId = k.chapterId ? (chSubject.get(k.chapterId) ?? null) : null;
    const front = esc(k.name);
    const back = esc(k.description ?? "");
    const subj = subjId ? subName.get(subjId) : undefined;
    const tags = subj ? tag(subj) : "";
    rows.push(`${front}\t${back}\t${tags}`);
  }

  // 单词卡片（正面：单词，背面：释义 + 例句）
  const bookName = new Map(d.wordbooks.map((b) => [b.id, b.name]));
  for (const w of d.words) {
    const front = esc(w.word);
    const back = esc(
      [
        w.meaning,
        w.example ? `例：${w.example}` : "",
        w.exampleMeaning ? `译：${w.exampleMeaning}` : "",
      ]
        .filter(Boolean)
        .join("<br>"),
    );
    const book = bookName.get(w.wordbookId);
    rows.push(`${front}\t${back}\t${book ? tag(book) : ""}`);
  }

  return rows.join("\n");
}
