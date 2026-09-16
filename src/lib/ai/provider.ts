// LLM Provider 抽象：DeepSeek（OpenAI 兼容协议）。
// 未来切换模型只需实现同一个 streamChat 接口（如 OpenAI / 通义 / 硅基流动）。
// 密钥全部来自环境变量，绝不硬编码。

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamChunk {
  /** 本次增量文本片段 */
  delta: string;
  /** 是否为最终块 */
  done: boolean;
  /** 仅在 done 块携带的用量统计 */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

const BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
const API_KEY = process.env.DEEPSEEK_API_KEY || "";
export const CHAT_MODEL = process.env.DEEPSEEK_CHAT_MODEL || "deepseek-chat";
export const REASONER_MODEL = process.env.DEEPSEEK_REASONER_MODEL || "deepseek-reasoner";

/** 是否已配置可用的 LLM。未配置时 AI 功能应提示用户，而非静默失败。 */
export function aiConfigured(): boolean {
  return API_KEY.length > 0;
}

/** 按老师模型档位解析实际模型名。 */
export function resolveModel(modelTier: string): string {
  return modelTier === "reasoner" ? REASONER_MODEL : CHAT_MODEL;
}

/** 简易成本估算（元）。DeepSeek 定价常变动，这里仅用于记录量级，非精确计费。 */
function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  // deepseek-chat 约 ¥1/百万输入、¥2/百万输出；reasoner 更高。取保守近似值。
  const isReasoner = model.includes("reasoner");
  const inPrice = isReasoner ? 4 : 1;
  const outPrice = isReasoner ? 16 : 2;
  return (promptTokens * inPrice + completionTokens * outPrice) / 1_000_000;
}

export { estimateCost };

/** 非流式补全结果。 */
export interface CompletionResult {
  text: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

/** 非流式调用（RAG 引用问答等一次性场景使用）。 */
export async function completeChat(opts: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
}): Promise<CompletionResult> {
  if (!aiConfigured()) {
    throw new Error("未配置 DEEPSEEK_API_KEY，请在 .env 中填写后重启");
  }
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream: false,
      temperature: opts.temperature ?? 0.7,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM 请求失败 (${res.status})：${text.slice(0, 300)}`);
  }
  const json = await res.json();
  const u = json?.usage ?? {};
  return {
    text: json?.choices?.[0]?.message?.content ?? "",
    usage: {
      promptTokens: u.prompt_tokens ?? 0,
      completionTokens: u.completion_tokens ?? 0,
      totalTokens: u.total_tokens ?? 0,
    },
  };
}

/**
 * 流式调用 chat/completions，逐段产出文本。
 * 通过 AsyncGenerator 屏蔽底层 SSE 解析细节；上游只需 for await。
 */
export async function* streamChat(opts: {
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  temperature?: number;
}): AsyncGenerator<StreamChunk> {
  if (!aiConfigured()) {
    throw new Error("未配置 DEEPSEEK_API_KEY，请在 .env 中填写后重启");
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream: true,
      temperature: opts.temperature ?? 0.7,
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM 请求失败 (${res.status})：${text.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 事件以空行分隔
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;

      let json: any;
      try {
        json = JSON.parse(payload);
      } catch {
        continue;
      }

      const delta: string = json?.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        yield { delta, done: false };
      }
      // usage 通常出现在最后一条带 finish_reason 的消息里
      if (json?.usage) {
        const u = json.usage;
        yield {
          delta: "",
          done: true,
          usage: {
            promptTokens: u.prompt_tokens ?? 0,
            completionTokens: u.completion_tokens ?? 0,
            totalTokens: u.total_tokens ?? 0,
          },
        };
      }
    }
  }
}
