import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chapters, knowledgePoints, subjects, teacherPersonas } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { MODES, type ChapterContext, type Mode } from "@/lib/ai/prompts";
import { ChatRoom } from "@/components/chat/chat-room";

export const dynamic = "force-dynamic";

// 互动教学入口：
//  - /learn/teach?kp=<知识点id>&mode=<能力> —— 围绕单个知识点教学
//  - /learn/teach?chapter=<章节id> —— 老师自动带学整个章节（规划→学习→考察→查缺补漏）
// 复用 ChatRoom，通过 URL 传入知识点/章节与初始能力。
export default async function TeachPage({
  searchParams,
}: {
  searchParams: { kp?: string; mode?: string; chapter?: string };
}) {
  const userId = await getUserId();
  if (!userId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">请先登录</div>;
  }

  const kpId = searchParams.kp ?? "";
  const chapterId = searchParams.chapter ?? "";
  const mode = searchParams.mode ?? "";
  const validMode = (MODES as readonly string[]).includes(mode) ? (mode as Mode) : null;
  const initialMode: Mode = chapterId ? "course" : (validMode ?? "explain");

  // 章节带学：加载本章名称 + 知识点清单（含说明与掌握状态），供老师规划与查缺补漏
  let chapter: (ChapterContext & { id: string }) | null = null;
  if (chapterId) {
    const ch = await db
      .select({ id: chapters.id, name: chapters.name })
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
      chapter = { id: ch.id, name: ch.name, kps };
    }
  }

  // 系统已收敛为「1 位老师」，取该用户最早创建的一位即可
  const teacher = await db
    .select()
    .from(teacherPersonas)
    .where(eq(teacherPersonas.userId, userId))
    .orderBy(asc(teacherPersonas.createdAt))
    .get();

  if (!teacher) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        还没有老师，请先到「我的老师」页确认
      </div>
    );
  }

  if (chapterId && !chapter) {
    return <div className="py-16 text-center text-sm text-muted-foreground">章节不存在</div>;
  }

  return (
    <div className="space-y-4">
      <Link href="/learn" className="text-sm text-muted-foreground hover:text-foreground">
        ← 返回学习
      </Link>
      <ChatRoom
        teacher={{
          id: teacher.id,
          name: teacher.name,
          type: teacher.type,
          subject: teacher.subject,
          modelTier: teacher.modelTier,
        }}
        initialKpId={kpId}
        initialMode={initialMode}
        initialChapter={chapter}
      />
    </div>
  );
}
