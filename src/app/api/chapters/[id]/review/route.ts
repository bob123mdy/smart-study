import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db, newId } from "@/db";
import {
  chapters,
  conversations,
  knowledgePoints,
  llmUsageLogs,
  messages,
  subjects,
  teacherPersonas,
} from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { aiConfigured, estimateCost, resolveModel } from "@/lib/ai/provider";
import { generateChapterReviewOutline, outlineToMarkdown } from "@/lib/ai/review";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 章节复习：学完大章节后，让 AI 产出结构化大纲并落库为一条复习会话消息。
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const chapter = await db
    .select({ id: chapters.id, name: chapters.name })
    .from(chapters)
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .where(and(eq(chapters.id, params.id), eq(subjects.userId, userId)))
    .get();
  if (!chapter) return NextResponse.json({ error: "章节不存在" }, { status: 404 });

  const kps = await db
    .select({ name: knowledgePoints.name })
    .from(knowledgePoints)
    .where(eq(knowledgePoints.chapterId, chapter.id))
    .all();
  const kpNames = kps.map((k) => k.name).filter(Boolean);

  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "未配置 DEEPSEEK_API_KEY，无法生成章节复习大纲。请在 .env 中填写后重启。" },
      { status: 503 },
    );
  }

  try {
    const { outline, usage } = await generateChapterReviewOutline(chapter.name, kpNames);
    const markdown = outlineToMarkdown(outline);

    // 关联第一位老师（若有），让复习会话出现在聊天室历史里
    const teacher = await db
      .select()
      .from(teacherPersonas)
      .where(eq(teacherPersonas.userId, userId))
      .orderBy(asc(teacherPersonas.createdAt))
      .get();
    const model = resolveModel(teacher?.modelTier ?? "basic");

    const convId = newId();
    await db
      .insert(conversations)
      .values({
        id: convId,
        userId,
        teacherPersonaId: teacher?.id ?? null,
        mode: "explain",
        title: `复习：${chapter.name}`,
        knowledgePointId: null,
      })
      .run();

    await db
      .insert(messages)
      .values({
        id: newId(),
        conversationId: convId,
        role: "assistant",
        content: markdown,
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
      })
      .run();

    await db
      .insert(llmUsageLogs)
      .values({
        id: newId(),
        userId,
        model,
        source: "chapter-review",
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        estimatedCost: estimateCost(model, usage.promptTokens, usage.completionTokens),
      })
      .run();

    return NextResponse.json({ outline, markdown, conversationId: convId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "生成复习大纲失败" },
      { status: 500 },
    );
  }
}
