// 章节复习：让 AI 产出该章节的「结构化思维导图大纲」（核心概念 → 子知识点）。
// 复用 completeChat 结构化 JSON 范式（与 curriculum.ts 同构），解析健壮；密钥由调用方先做 aiConfigured() 判断。

import { CHAT_MODEL, completeChat } from "./provider";

export interface ReviewSection {
  title: string;
  points: string[];
}

export interface ReviewOutline {
  title: string;
  summary?: string;
  sections: ReviewSection[];
}

/** 从 LLM 原始文本中剥离可能的 Markdown 围栏并解析出 JSON。 */
function extractJson(text: string): unknown {
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI 返回内容不是合法 JSON，请重试");
  }
  return JSON.parse(s.slice(start, end + 1));
}

/** 把未知结构校验/收敛为 ReviewOutline，防御性过滤。 */
function parseOutline(raw: unknown): ReviewOutline {
  if (!raw || typeof raw !== "object") throw new Error("AI 返回结构无效，请重试");
  const obj = raw as Record<string, unknown>;

  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  const summary = typeof obj.summary === "string" ? obj.summary.trim() : undefined;

  const sections: ReviewSection[] = (Array.isArray(obj.sections) ? obj.sections : [])
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      title: typeof s.title === "string" ? s.title.trim() : "",
      points: (Array.isArray(s.points) ? s.points : [])
        .filter((p): p is string => typeof p === "string" && !!p.trim())
        .map((p) => p.trim()),
    }))
    .filter((s) => s.title && s.points.length > 0);

  if (!sections.length) throw new Error("AI 未生成有效的大纲，请重试");
  return { title, summary, sections };
}

const SYSTEM_PROMPT = `你是学习复习助手。用户学完某章节后，需要你产出一份结构化的「思维导图大纲」用于总体复习。

要求：
1. 用 3~8 个核心概念（section）概括本章内容，每个概念下列 2~6 个子知识点（point），用简洁名词短语。
2. 概括要覆盖本章给出的全部知识点，不遗漏、不虚构、不偏离到章节之外。
3. 只输出一个 JSON 对象，不要 Markdown 代码块、不要任何解释文字。

输出 JSON 结构（示例）：
{"title":"第1章 行列式","summary":"行列式是研究线性方程组的工具，本章掌握其计算与性质。","sections":[{"title":"行列式的定义与计算","points":["二阶与三阶行列式","按行展开"]},{"title":"行列式的性质","points":["互换行变号","倍加不变","行列式为零的条件"]}]}`;

/** 调用 LLM 生成章节复习大纲。未配置密钥时由调用方先做 aiConfigured() 判断，这里不重复检查。 */
export async function generateChapterReviewOutline(
  chapterName: string,
  kpNames: string[],
): Promise<{
  outline: ReviewOutline;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}> {
  const res = await completeChat({
    model: CHAT_MODEL,
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `请为章节「${chapterName}」生成复习大纲。该章包含知识点：${kpNames.join("、")}。`,
      },
    ],
  });
  return { outline: parseOutline(extractJson(res.text)), usage: res.usage };
}

/** 大纲 → Markdown（落库到复习会话消息，便于历史回看与导出）。 */
export function outlineToMarkdown(o: ReviewOutline): string {
  const lines: string[] = [];
  lines.push(`# ${o.title || "章节复习"}`);
  if (o.summary) lines.push(`> ${o.summary}`);
  for (const s of o.sections) {
    lines.push(`## ${s.title}`);
    for (const p of s.points) lines.push(`- ${p}`);
  }
  return lines.join("\n");
}
