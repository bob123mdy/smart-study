import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { aiConfigured } from "@/lib/ai/provider";
import { generateCurriculumStructure } from "@/lib/ai/curriculum";
import { persistSubjectStructure } from "@/lib/curriculum";

export const dynamic = "force-dynamic";

// 从书名生成科目 → 章节 → 知识点（AI 增强；未配置 AI 时优雅提示走人工录入）
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const bookName = (body?.bookName ?? "").toString().trim();
  if (!bookName) return NextResponse.json({ error: "请输入书名" }, { status: 400 });

  if (!aiConfigured()) {
    return NextResponse.json({
      ok: false,
      reason: "未配置 DEEPSEEK_API_KEY，请在 .env 填写后重启；或手动「新建科目」并添加章节/知识点",
    });
  }

  try {
    const structure = await generateCurriculumStructure(bookName);
    const { subjectId, chapterCount, knowledgePointCount } = await persistSubjectStructure(userId, structure);
    return NextResponse.json({
      ok: true,
      subjectId,
      subjectName: structure.subjectName,
      chapterCount,
      knowledgePointCount,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      reason: e instanceof Error ? e.message : "生成失败，请重试",
    });
  }
}
