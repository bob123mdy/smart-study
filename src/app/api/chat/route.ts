import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
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
import { buildSystemPrompt, MODES, type ChapterContext, type Mode } from "@/lib/ai/prompts";
import {
  aiConfigured,
  estimateCost,
  resolveModel,
  streamChat,
  type ChatMessage,
} from "@/lib/ai/provider";
import { buildProfile } from "@/lib/ai/profile";
import { retrieve } from "@/lib/rag/retrieve";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

function sse(res: ReadableStreamDefaultController, obj: unknown) {
  res.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "未登录" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const teacherPersonaId = String(body.teacherPersonaId ?? "");
  const message = String(body.message ?? "").trim();
  const mode: Mode = (MODES as readonly string[]).includes(String(body.mode))
    ? (body.mode as Mode)
    : "explain";
  const conversationId = body.conversationId ? String(body.conversationId) : null;
  const knowledgePointId = body.knowledgePointId ? String(body.knowledgePointId) : null;
  const chapterId = body.chapterId ? String(body.chapterId) : null;

  if (!message) {
    return Response.json({ error: "消息不能为空" }, { status: 400 });
  }
  if (!teacherPersonaId) {
    return Response.json({ error: "缺少老师身份" }, { status: 400 });
  }
  if (!aiConfigured()) {
    return Response.json(
      { error: "未配置 DEEPSEEK_API_KEY。请在 .env 中填写后重启，AI 对话才会生效。" },
      { status: 503 },
    );
  }

  const teacher = await db
    .select()
    .from(teacherPersonas)
    .where(and(eq(teacherPersonas.id, teacherPersonaId), eq(teacherPersonas.userId, userId)))
    .get();
  if (!teacher) {
    return Response.json({ error: "老师不存在" }, { status: 404 });
  }

  // 知识点上下文（名称/说明/所属章节与科目，注入 system prompt；校验归属当前用户）
  let kp: { name: string; description: string | null; chapter: string | null; subject: string | null } | null =
    null;
  if (knowledgePointId) {
    kp =
      (await db
        .select({
          name: knowledgePoints.name,
          description: knowledgePoints.description,
          chapter: chapters.name,
          subject: subjects.name,
        })
        .from(knowledgePoints)
        .innerJoin(chapters, eq(knowledgePoints.chapterId, chapters.id))
        .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
        .where(and(eq(knowledgePoints.id, knowledgePointId), eq(subjects.userId, userId)))
        .get()) ?? null;
  }

  // 章节带学上下文（本章名称 + 知识点清单/掌握状态，注入 system prompt；校验归属当前用户）
  let chapter: ChapterContext | null = null;
  if (chapterId) {
    const ch = await db
      .select({ name: chapters.name })
      .from(chapters)
      .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
      .where(and(eq(chapters.id, chapterId), eq(subjects.userId, userId)))
      .get();
    if (ch) {
      const kps = await db
        .select({
          name: knowledgePoints.name,
          description: knowledgePoints.description,
          status: knowledgePoints.status,
        })
        .from(knowledgePoints)
        .where(eq(knowledgePoints.chapterId, chapterId))
        .all();
      chapter = { name: ch.name, kps };
    }
  }

  // 加载或新建会话
  let convId = conversationId;
  if (convId) {
    const conv = await db.select().from(conversations).where(eq(conversations.id, convId)).get();
    if (!conv) convId = null;
  }
  if (!convId) {
    convId = newId();
    await db
      .insert(conversations)
      .values({
        id: convId,
        userId,
        teacherPersonaId,
        mode,
        title: chapter ? `带学：${chapter.name}` : message.slice(0, 20),
        knowledgePointId,
      })
      .run();
  }

  // 历史消息（取最近 30 条，按时间正序；保存当前用户消息之前取，避免重复）
  const history = (
    await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(desc(messages.createdAt))
      .limit(30)
      .all()
  ).reverse();

  const userMsgId = newId();
  await db
    .insert(messages)
    .values({ id: userMsgId, conversationId: convId, role: "user", content: message })
    .run();

  // 资料库检索：让老师能引用用户上传的资料（无资料/无匹配时为空，不影响回答）。
  // embedding 服务抖动或未配置时降级为空，绝不阻断对话。
  let sources: Awaited<ReturnType<typeof retrieve>> = [];
  try {
    sources = await retrieve(`${message} ${kp?.name ?? ""}`.trim(), 3, userId);
  } catch {
    sources = [];
  }

  const chatMessages: ChatMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt({
        personaName: teacher.name,
        personaPrompt: teacher.systemPrompt,
        personaType: teacher.type,
        mode,
        profile: await buildProfile(userId),
        knowledgePoint: kp,
        chapter,
        sources,
      }),
    },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: message },
  ];

  const model = resolveModel(teacher.modelTier);
  const abort = new AbortController();

  let full = "";
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      sse(controller, { type: "meta", conversationId: convId, messageId: userMsgId });
      try {
        for await (const chunk of streamChat({
          model,
          messages: chatMessages,
          signal: abort.signal,
        })) {
          if (chunk.done) {
            if (chunk.usage) usage = chunk.usage;
          } else if (chunk.delta) {
            full += chunk.delta;
            sse(controller, { type: "delta", content: chunk.delta });
          }
        }

        const asstMsgId = newId();
        await db
          .insert(messages)
          .values({
            id: asstMsgId,
            conversationId: convId,
            role: "assistant",
            content: full,
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
            source: "chat",
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            estimatedCost: estimateCost(model, usage.promptTokens, usage.completionTokens),
          })
          .run();
        await db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, convId))
          .run();

        sse(controller, { type: "done", messageId: asstMsgId, content: full, usage });
        controller.close();
      } catch (e) {
        // 即使中途失败，也保留已生成的部分
        if (full) {
          await db
            .insert(messages)
            .values({
              id: newId(),
              conversationId: convId,
              role: "assistant",
              content: full,
              model,
            })
            .run();
        }
        const err = e instanceof Error ? e.message : "生成失败";
        sse(controller, { type: "error", error: err });
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
