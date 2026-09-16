// Embedding 客户端：硅基流动 SiliconFlow 的 BGE 中文向量模型（OpenAI 兼容协议）。
// 注意：DeepSeek 官方不提供 embedding，故此处独立接 SiliconFlow。

const BASE_URL = (process.env.EMBEDDING_BASE_URL || "https://api.siliconflow.cn/v1").replace(/\/$/, "");
const API_KEY = process.env.EMBEDDING_API_KEY || "";
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "BAAI/bge-large-zh-v1.5";

/** 是否已配置 embedding。未配置时检索降级为本地关键词匹配（无 AI 也能用）。 */
export function embeddingConfigured(): boolean {
  return API_KEY.length > 0;
}

/** 批量文本向量化，返回与输入顺序一致的向量数组。 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!embeddingConfigured()) {
    throw new Error("未配置 EMBEDDING_API_KEY");
  }
  if (texts.length === 0) return [];

  const out: number[][] = [];
  const BATCH = 16;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await fetch(`${BASE_URL}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch, encoding_format: "float" }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Embedding 请求失败 (${res.status})：${t.slice(0, 200)}`);
    }
    const json = await res.json();
    const data = (json.data ?? []).sort((a: { index: number }, b: { index: number }) => a.index - b.index);
    for (const item of data) out.push(item.embedding as number[]);
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}
