import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { chapters, knowledgePoints, kpStatus, subjects, type KpStatus } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const masteryOf: Record<KpStatus, number> = {
  not_started: 0,
  learning: 0.5,
  mastered: 1,
};

// 校验知识点归属当前用户（知识点无 user_id，通过 章节→科目 关联）
async function ownsKnowledgePoint(userId: string, kpId: string) {
  return await db
    .select({ id: knowledgePoints.id })
    .from(knowledgePoints)
    .innerJoin(chapters, eq(knowledgePoints.chapterId, chapters.id))
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .where(and(eq(knowledgePoints.id, kpId), eq(subjects.userId, userId)))
    .get();
}

// 更新知识点（状态/掌握度/描述等）
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await ownsKnowledgePoint(userId, params.id);
  if (!existing) return NextResponse.json({ error: "知识点不存在" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (body?.status !== undefined) {
    const status = String(body.status) as KpStatus;
    if (!kpStatus.includes(status))
      return NextResponse.json({ error: "非法的知识点状态" }, { status: 400 });
    patch.status = status;
    patch.mastery = masteryOf[status];
    patch.lastReviewedAt = new Date();
  }
  if (body?.name !== undefined) patch.name = String(body.name).trim();
  if (body?.description !== undefined) patch.description = body.description ? String(body.description) : null;
  if (body?.difficulty !== undefined) patch.difficulty = Number(body.difficulty);

  // 前置知识点：接受 ID 数组，去重、排除自身，并校验均归属当前用户后存为 JSON 字符串
  if (body?.prerequisites !== undefined) {
    const raw: unknown = body.prerequisites;
    const arr: string[] = Array.isArray(raw)
      ? [...new Set(raw.map((v) => String(v)).filter((x) => !!x && x !== params.id))]
      : [];
    if (arr.length) {
      const valid = await db
        .select({ id: knowledgePoints.id })
        .from(knowledgePoints)
        .innerJoin(chapters, eq(knowledgePoints.chapterId, chapters.id))
        .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
        .where(and(inArray(knowledgePoints.id, arr), eq(subjects.userId, userId)))
        .all();
      const validIds = new Set(valid.map((r) => r.id));
      const final = arr.filter((id) => validIds.has(id));
      patch.prerequisites = final.length ? JSON.stringify(final) : null;
    } else {
      patch.prerequisites = null;
    }
  }

  await db.update(knowledgePoints).set(patch).where(eq(knowledgePoints.id, params.id)).run();
  const row = await db.select().from(knowledgePoints).where(eq(knowledgePoints.id, params.id)).get();
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await ownsKnowledgePoint(userId, params.id);
  if (!existing) return NextResponse.json({ error: "知识点不存在" }, { status: 404 });

  await db.delete(knowledgePoints).where(eq(knowledgePoints.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
