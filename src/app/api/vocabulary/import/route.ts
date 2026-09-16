import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, newId } from "@/db";
import { wordbooks, words } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface ImportWord {
  word: string;
  meaning: string;
  phonetic?: string | null;
  example?: string | null;
  exampleMeaning?: string | null;
}

// 解析导入文本：支持 JSON 数组 / CSV 行 "word,meaning[,phonetic]" / TXT 行 "word meaning"
function parseWords(format: string, content: string): ImportWord[] | { error: string } {
  const text = content.trim();
  if (!text) return { error: "导入内容为空" };

  if (format === "json") {
    try {
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) return { error: "JSON 需为数组" };
      const out: ImportWord[] = [];
      for (const it of arr) {
        if (!it || typeof it !== "object") continue;
        const word = String(it.word ?? it.term ?? "").trim();
        const meaning = String(it.meaning ?? it.definition ?? it.translation ?? "").trim();
        if (word && meaning) {
          out.push({
            word,
            meaning,
            phonetic: it.phonetic ? String(it.phonetic) : null,
            example: it.example ? String(it.example) : null,
            exampleMeaning: it.exampleMeaning ? String(it.exampleMeaning) : null,
          });
        }
      }
      return out;
    } catch {
      return { error: "JSON 解析失败" };
    }
  }

  if (format === "csv") {
    const out: ImportWord[] = [];
    for (const line of text.split(/\r?\n/)) {
      const parts = line.split(",").map((s) => s.trim());
      const [word, meaning, phonetic] = parts;
      if (word && meaning) out.push({ word, meaning, phonetic: phonetic || null });
    }
    return out;
  }

  // txt：每行 "word 释义"，按首个空白切分
  const out: ImportWord[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(\S+)\s+(.+)$/);
    if (m) out.push({ word: m[1], meaning: m[2] });
  }
  return out;
}

// 导入词表：可指定已有自定义词库，或新建词库；已存在的单词自动跳过
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "请求体无效" }, { status: 400 });

  const format = String(body.format ?? (Array.isArray(body.items) ? "json" : body.content?.includes(",") ? "csv" : "txt"));
  const content = Array.isArray(body.items) ? JSON.stringify(body.items) : String(body.content ?? "");

  const parsed = parseWords(format, content);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.length === 0) return NextResponse.json({ error: "未解析到有效单词" }, { status: 400 });

  // 确定目标词库
  let bookId = String(body.bookId ?? "");
  let createdBook = false;
  if (bookId) {
    const book = await db.select().from(wordbooks).where(eq(wordbooks.id, bookId)).get();
    if (!book) return NextResponse.json({ error: "词库不存在" }, { status: 404 });
    if (book.isBuiltin) return NextResponse.json({ error: "内置词库不可导入" }, { status: 400 });
    if (book.userId !== userId) return NextResponse.json({ error: "无权操作该词库" }, { status: 403 });
  } else {
    bookId = newId();
    const name = String(body.name ?? "").trim() || "导入词库";
    await db
      .insert(wordbooks)
      .values({ id: bookId, userId, name, description: null, isBuiltin: false, source: "import", sortOrder: 0 })
      .run();
    createdBook = true;
  }

  // 查询已有单词，按 word 去重跳过
  const existingRows = await db
    .select({ word: words.word, sortOrder: words.sortOrder })
    .from(words)
    .where(eq(words.wordbookId, bookId))
    .orderBy(asc(words.sortOrder))
    .all();
  const existing = new Set(existingRows.map((w) => w.word));
  let maxSort = existingRows.reduce((m, w) => Math.max(m, w.sortOrder), 0);

  let inserted = 0;
  let skipped = 0;
  for (const it of parsed) {
    const key = it.word.toLowerCase();
    if (existing.has(key)) {
      skipped++;
      continue;
    }
    await db
      .insert(words)
      .values({
        id: newId(),
        wordbookId: bookId,
        word: it.word,
        phonetic: it.phonetic ?? null,
        meaning: it.meaning,
        example: it.example ?? null,
        exampleMeaning: it.exampleMeaning ?? null,
        sortOrder: ++maxSort,
      })
      .run();
    existing.add(key);
    inserted++;
  }

  return NextResponse.json({ bookId, createdBook, inserted, skipped, total: parsed.length });
}
