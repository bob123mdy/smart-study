import { NextRequest, NextResponse } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { db, newId, USE_PG } from "@/db";
import { documentChunks, documents } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { detectType, extractText } from "@/lib/rag/extract";
import { chunkText } from "@/lib/rag/chunk";
import { embedTexts, embeddingConfigured, EMBEDDING_MODEL } from "@/lib/rag/embed";

export const dynamic = "force-dynamic";

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

// 文档列表
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt))
    .limit(100)
    .all();
  return NextResponse.json(rows);
}

// 上传并解析文档：提取 → 切分 → 向量化（可选）
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "未收到文件" }, { status: 400 });
  }

  const originalName = file.name;
  const type = detectType(originalName);
  if (!type) {
    return NextResponse.json({ error: "仅支持 txt / md / pdf / docx 格式" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "文件超过 20MB 限制" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const id = newId();

  await db
    .insert(documents)
    .values({
      id,
      userId,
      title: originalName,
      fileType: type,
      originalName,
      fileSize: file.size,
      status: "indexing",
      chunkCount: 0,
    })
    .run();

  try {
    const text = await extractText(originalName, buffer);
    if (!text.trim()) throw new Error("未能从文件中提取到文本（可能是扫描版 PDF 或空文档）");

    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("切分后无有效内容");

    for (const [i, content] of chunks.entries()) {
      await db
        .insert(documentChunks)
        .values({
          id: newId(),
          documentId: id,
          chunkIndex: i,
          content,
          tokenCount: Math.ceil(content.length / 2),
        })
        .run();
    }

    // 向量化（有 key 才做；失败降级为关键词检索，不阻断上传）
    let status = "ready_no_embedding";
    if (embeddingConfigured()) {
      try {
        const vecs = await embedTexts(chunks);
        const rows = await db
          .select()
          .from(documentChunks)
          .where(eq(documentChunks.documentId, id))
          .orderBy(asc(documentChunks.chunkIndex))
          .all();
        for (const [i, row] of rows.entries()) {
          // PG 模式 vector 列直接写 number[]（drizzle 自动序列化）；SQLite 模式写 JSON 字符串。
          const embeddingVal = USE_PG ? (vecs[i] as unknown as string) : JSON.stringify(vecs[i]);
          await db
            .update(documentChunks)
            .set({ embedding: embeddingVal, embeddingModel: EMBEDDING_MODEL })
            .where(eq(documentChunks.id, row.id))
            .run();
        }
        status = "ready";
      } catch {
        status = "ready_no_embedding";
      }
    }

    await db
      .update(documents)
      .set({ status, chunkCount: chunks.length, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .run();

    const row = await db.select().from(documents).where(eq(documents.id, id)).get();
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "解析失败";
    await db
      .update(documents)
      .set({ status: "error", errorMsg: msg, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .run();
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
