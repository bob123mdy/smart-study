// 从书名/学科名生成完整学习结构（科目 → 章节 → 知识点）。
// 走 LLM 结构化输出（JSON），解析健壮；密钥来自环境变量，未配置时由调用方兜底。

import { CHAT_MODEL, completeChat } from "./provider";

export interface CurriculumChapter {
  name: string;
  description?: string;
  knowledgePoints: string[];
}

export interface CurriculumStructure {
  subjectName: string;
  description?: string;
  chapters: CurriculumChapter[];
}

const MAX_CHAPTERS = 30;
const MAX_KPS_PER_CHAPTER = 20;

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

/** 把未知结构校验/收敛为 CurriculumStructure，防御性截断，避免失控写入。 */
function parseStructure(raw: unknown, bookName: string): CurriculumStructure {
  if (!raw || typeof raw !== "object") throw new Error("AI 返回结构无效，请重试");
  const obj = raw as Record<string, unknown>;

  // 以用户输入的书名为准，忽略 LLM 返回的 subjectName，避免模型张冠李戴
  const subjectName = bookName.replace(/^《/, "").replace(/》$/, "");
  const description = typeof obj.description === "string" ? obj.description : undefined;

  const chapters: CurriculumChapter[] = (Array.isArray(obj.chapters) ? obj.chapters : [])
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .slice(0, MAX_CHAPTERS)
    .map((c) => {
      const kps = Array.isArray(c.knowledgePoints)
        ? c.knowledgePoints
            .filter((k): k is string => typeof k === "string" && !!k.trim())
            .map((k) => k.trim())
        : [];
      return {
        name: typeof c.name === "string" ? c.name.trim() : "",
        description: typeof c.description === "string" ? c.description : undefined,
        knowledgePoints: kps.slice(0, MAX_KPS_PER_CHAPTER),
      };
    })
    .filter((c) => c.name && c.knowledgePoints.length > 0);

  if (!chapters.length) throw new Error("AI 未生成有效的章节结构，请重试");
  return { subjectName, description, chapters };
}

const SYSTEM_PROMPT = `你是教材大纲生成器。用户给出一本书名或学科名，你输出该书完整的章节结构与每章的核心知识点，用于构建学习计划。

要求：
1. 章节标题必须具体、真实对应这本书的内容（例如《线性代数》应包含「行列式」「矩阵」「向量空间」等，而不是「概述」「基础理论」这类空泛标题）。
2. 章节数量 6~15 个，覆盖全书合理学习顺序。
3. 每个章节 3~8 个知识点，知识点用简洁的名词短语。
4. 只输出一个 JSON 对象，不要 Markdown 代码块、不要任何解释文字。

输出 JSON 结构（示例）：
{"subjectName":"高等数学","description":"理工科基础数学","chapters":[{"name":"第1章 函数与极限","description":"函数的定义与极限概念","knowledgePoints":["函数的概念","极限的定义","极限运算法则"]}]}`;

/** 调用 LLM 生成学习结构。未配置密钥时由调用方先做 aiConfigured() 判断，这里不重复检查。 */
export async function generateCurriculumStructure(bookName: string): Promise<CurriculumStructure> {
  const res = await completeChat({
    model: CHAT_MODEL,
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `请生成《${bookName.trim()}》的学习结构。` },
    ],
  });
  return parseStructure(extractJson(res.text), bookName.trim());
}
