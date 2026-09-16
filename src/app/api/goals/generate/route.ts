import { NextResponse } from "next/server";
import { db, newId } from "@/db";
import { goals } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { aiConfigured } from "@/lib/ai/provider";
import { generateCurriculumStructure } from "@/lib/ai/curriculum";
import { persistSubjectStructure } from "@/lib/curriculum";
import { decomposeGoal, saveDecomposition } from "@/lib/decompose";

export const dynamic = "force-dynamic";

// 从书名一键生成：科目 → 章节 → 知识点 → 长期目标 → 里程碑 → 每日任务
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const bookName = (body?.bookName ?? "").toString().trim();
  const startDate = (body?.startDate ?? "").toString();
  const targetDate = (body?.targetDate ?? "").toString();
  if (!bookName) return NextResponse.json({ error: "请输入书名" }, { status: 400 });
  if (!startDate || !targetDate) return NextResponse.json({ error: "请选择开始与目标日期" }, { status: 400 });

  if (!aiConfigured()) {
    return NextResponse.json({
      ok: false,
      reason: "未配置 DEEPSEEK_API_KEY，请在 .env 填写后重启；或手动新建科目并「模板拆解」",
    });
  }

  try {
    const structure = await generateCurriculumStructure(bookName);
    const { subjectId, chapterCount, knowledgePointCount } = await persistSubjectStructure(userId, structure);

    const goalId = newId();
    await db
      .insert(goals)
      .values({
        id: goalId,
        userId,
        title: `学完《${bookName}》`,
        description: structure.description ?? null,
        subjectId,
        startDate,
        targetDate,
        status: "active" as const,
        progress: 0,
      })
      .run();

    const result = await decomposeGoal(subjectId, startDate, targetDate);
    const { milestoneCount, taskCount } = await saveDecomposition(userId, goalId, result);

    return NextResponse.json({
      ok: true,
      subjectId,
      subjectName: structure.subjectName,
      chapterCount,
      knowledgePointCount,
      goalId,
      milestoneCount,
      taskCount,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      reason: e instanceof Error ? e.message : "生成失败，请重试",
    });
  }
}
