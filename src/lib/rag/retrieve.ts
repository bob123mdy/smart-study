// 检索：优先向量余弦相似度（需 embedding），无 embedding 时降级为本地关键词匹配。
// 两种模式均不依赖 LLM，保证「无 AI 也能检索」。

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { documentChunks, documents } from "@/db/schema";
import { embedQuery, embeddingConfigured } from "./embed";

export interface RetrievedChunk {
  documentId: string;
  title: string;
  content: string;
  similarity: number;
}

export function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

const VECTOR_THRESHOLD = 0.35;
const KEYWORD_THRESHOLD = 0.5;

function parseEmbedding(s: string | null): number[] | null {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// 兼容双模式：SQLite 模式 embedding 存 JSON 字符串；PG 模式 drizzle 自动把 vector 列解析为 number[]。
function toVec(embedding: unknown): number[] | null {
  if (Array.isArray(embedding)) return embedding as number[];
  if (typeof embedding === "string") return parseEmbedding(embedding);
  return null;
}

export async function retrieve(
  rawQuery: string,
  topK = 4,
  userId: string,
): Promise<RetrievedChunk[]> {
  const query = rawQuery.trim();
  if (!query) return [];

  // 只检索当前用户上传的资料
  const docs = await db.select().from(documents).where(eq(documents.userId, userId)).all();
  const docIds = docs.map((d) => d.id);
  const chunks = docIds.length
    ? await db.select().from(documentChunks).where(inArray(documentChunks.documentId, docIds)).all()
    : [];
  const titleById = new Map(docs.map((d) => [d.id, d.title]));
  if (chunks.length === 0) return [];

  const useVector = embeddingConfigured();
  let scored: RetrievedChunk[];

  if (useVector) {
    const qv = await embedQuery(query);
    scored = chunks
      .map((c) => {
        const v = toVec(c.embedding);
        return {
          documentId: c.documentId,
          title: titleById.get(c.documentId) ?? "未命名",
          content: c.content,
          similarity: v ? cosine(qv, v) : 0,
        };
      })
      .filter((r) => r.similarity >= VECTOR_THRESHOLD);
  } else {
    // 关键词兜底：统计问题中的字符在 chunk 中的命中率
    const qChars = [...new Set(query.replace(/[^一-龥a-zA-Z0-9]/g, ""))];
    scored = chunks.map((c) => {
      const hit = qChars.filter((ch) => c.content.includes(ch)).length;
      const similarity = qChars.length ? hit / qChars.length : 0;
      return {
        documentId: c.documentId,
        title: titleById.get(c.documentId) ?? "未命名",
        content: c.content,
        similarity,
      };
    }).filter((r) => r.similarity >= KEYWORD_THRESHOLD);
  }

  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
}
