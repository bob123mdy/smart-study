import { NextRequest } from "next/server";
import { db, newId } from "@/db";
import { llmUsageLogs } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { retrieve } from "@/lib/rag/retrieve";
import {
  aiConfigured,
  CHAT_MODEL,
  completeChat,
  estimateCost,
  type ChatMessage,
} from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT =
  "你是资料库问答助手。只依据下面提供的资料回答问题，并在答案末尾注明引用来源（如【资料1】）。" +
  "如果资料不足以回答，明确回答「资料中未提及」，绝不编造或补充资料外的事实。";

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const question = String(body?.question ?? "").trim();
  if (!question) {
    return Response.json({ error: "问题不能为空" }, { status: 400 });
  }

  const sources = await retrieve(question, 4, userId);

  if (sources.length === 0) {
    return Response.json({
      answer: `资料库中未提及与「${question}」相关的内容。请确认已上传相关资料，或换个问法。`,
      sources: [],
      matched: false,
    });
  }

  const sourcePayload = sources.map((s) => ({
    title: s.title,
    content: s.content,
    similarity: Math.round(s.similarity * 100) / 100,
  }));

  // 无 LLM：返回检索到的原文（无 AI 也能用）
  if (!aiConfigured()) {
    const answer =
      "（未配置 DEEPSEEK_API_KEY，以下为资料库中检索到的相关原文）\n\n" +
      sources.map((s, i) => `【资料${i + 1}·${s.title}】\n${s.content}`).join("\n\n");
    return Response.json({ answer, sources: sourcePayload, matched: true });
  }

  // 有 LLM：基于资料回答 + 引用
  const context = sources
    .map((s, i) => `【资料${i + 1} · 来源《${s.title}》】\n${s.content}`)
    .join("\n\n");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `资料：\n${context}\n\n问题：${question}` },
  ];

  const result = await completeChat({ model: CHAT_MODEL, messages });

  await db
    .insert(llmUsageLogs)
    .values({
      id: newId(),
      userId,
      model: CHAT_MODEL,
      source: "rag",
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
      estimatedCost: estimateCost(CHAT_MODEL, result.usage.promptTokens, result.usage.completionTokens),
    })
    .run();

  return Response.json({ answer: result.text, sources: sourcePayload, matched: true });
}
