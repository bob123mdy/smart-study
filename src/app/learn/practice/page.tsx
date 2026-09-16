import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chapters, knowledgePoints, subjects } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { PracticeSession } from "@/components/learn/practice-session";

export const dynamic = "force-dynamic";

// 练习入口：/learn/practice?kp=<知识点id>
// 服务端先校验知识点归属当前用户，再交给客户端组件出题互动。
export default async function PracticePage({ searchParams }: { searchParams: { kp?: string } }) {
  const userId = await getUserId();
  if (!userId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">请先登录</div>;
  }

  const kpId = searchParams.kp ?? "";
  if (!kpId) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        请从「学习」页选择一个知识点，点「练习」进入
      </div>
    );
  }

  const kp = await db
    .select({ id: knowledgePoints.id, name: knowledgePoints.name })
    .from(knowledgePoints)
    .innerJoin(chapters, eq(knowledgePoints.chapterId, chapters.id))
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .where(and(eq(knowledgePoints.id, kpId), eq(subjects.userId, userId)))
    .get();

  if (!kp) {
    return <div className="py-16 text-center text-sm text-muted-foreground">知识点不存在</div>;
  }

  return (
    <div className="space-y-4">
      <Link href="/learn" className="text-sm text-muted-foreground hover:text-foreground">
        ← 返回学习
      </Link>
      <PracticeSession kpId={kp.id} kpName={kp.name} />
    </div>
  );
}
