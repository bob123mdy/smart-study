// AI 出题：围绕知识点生成一道单选题（结构化 JSON）。
// 复用 completeChat 结构化 JSON 范式（与 review.ts / curriculum.ts 同构），解析健壮。
import { CHAT_MODEL, completeChat } from "./provider";

export interface McqQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

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

/** 把未知结构校验/收敛为 McqQuestion，防御性过滤。 */
function parseMcq(raw: unknown): McqQuestion {
  if (!raw || typeof raw !== "object") throw new Error("AI 返回结构无效，请重试");
  const obj = raw as Record<string, unknown>;

  const question = typeof obj.question === "string" ? obj.question.trim() : "";
  const options = (Array.isArray(obj.options) ? obj.options : [])
    .filter((o): o is string => typeof o === "string" && !!o.trim())
    .map((o) => o.trim());
  const answer = Number(obj.answer);
  const explanation = typeof obj.explanation === "string" ? obj.explanation.trim() : "";

  if (!question || options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) {
    throw new Error("AI 未生成有效的题目，请重试");
  }
  return { question, options, answer, explanation };
}

const SYSTEM_PROMPT = `你是出题老师。根据用户给的知识点，出一道单选题，考察是否真正理解概念（而非死记定义）。

要求：
1. 题干清晰，直击知识点的核心概念。
2. 4 个选项，只有 1 个正确；干扰项要合理（常见误解），不能明显荒谬。
3. answer 为正确选项索引（0~3），并给出一句解析（为什么对、为什么错）。
4. 只输出一个 JSON 对象，不要 Markdown 代码块、不要任何解释文字。

输出 JSON 结构（示例）：
{"question":"关于行列式的性质，下列说法正确的是？","options":["交换两行，行列式不变","交换两行，行列式变号","行列式为零则矩阵可逆","行列式与转置不相等"],"answer":1,"explanation":"交换两行行列式变号，这是行列式的基本性质。"}`;

/** 调用 LLM 生成单选题。未配置密钥时由调用方先做 aiConfigured() 判断，这里不重复检查。 */
export async function generateMcq(context: {
  name: string;
  description?: string | null;
  chapter?: string | null;
  subject?: string | null;
}): Promise<{
  mcq: McqQuestion;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}> {
  const bits = [`知识点：${context.name}`];
  if (context.chapter || context.subject) {
    bits.push(`所属：${[context.chapter, context.subject].filter(Boolean).join(" › ")}`);
  }
  if (context.description) bits.push(`说明：${context.description}`);

  const res = await completeChat({
    model: CHAT_MODEL,
    temperature: 0.7,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `请围绕以下知识点出一道单选题。\n${bits.join("\n")}` },
    ],
  });
  return { mcq: parseMcq(extractJson(res.text)), usage: res.usage };
}
