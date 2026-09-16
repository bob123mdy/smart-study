"use client";

import useSWR from "swr";
import Link from "next/link";
import { api, fetcher } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CompletionRing } from "@/components/dashboard/completion-ring";
import { StudyHeatmap, type HeatmapDay } from "@/components/dashboard/study-heatmap";
import { AlertTriangle, BookOpen, CheckCircle2, Clock, Compass, Flame, Hourglass, Target } from "lucide-react";

interface Overview {
  subjectCount: number;
  chapterCount: number;
  kpTotal: number;
  mastered: number;
  learning: number;
  notStarted: number;
  completionRate: number;
  totalMinutes: number;
  todayMinutes: number;
  streakDays: number;
}

interface Task {
  id: string;
  title: string;
  status: string;
  scheduledDate: string | null;
  estimatedMinutes: number;
}
interface Goal {
  id: string;
  title: string;
  tasks: Task[];
}
type NextUpKind = "review_kp" | "review_wq" | "weak" | "ready";
interface NextUpItem {
  kind: NextUpKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}
interface Settings {
  retention: number;
  dailyGoalMinutes: number;
  dailyGoalOptions: number[];
}

const KIND_ICON: Record<NextUpKind, React.ElementType> = {
  review_kp: BookOpen,
  review_wq: AlertTriangle,
  weak: Target,
  ready: CheckCircle2,
};
const KIND_STYLE: Record<NextUpKind, string> = {
  review_kp: "bg-blue-100 text-blue-700",
  review_wq: "bg-orange-100 text-orange-700",
  weak: "bg-amber-100 text-amber-700",
  ready: "bg-emerald-100 text-emerald-700",
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-sm">{label}</span>
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: overview } = useSWR<Overview>("/api/stats/overview", fetcher);
  const { data: heatmap } = useSWR<HeatmapDay[]>("/api/stats/heatmap?weeks=15", fetcher);
  const { data: goals, mutate: mutateGoals } = useSWR<Goal[]>("/api/goals", fetcher);
  const { data: settings, mutate: mutateSettings } = useSWR<Settings>("/api/settings", fetcher);
  const { data: nextUpData } = useSWR<{ items: NextUpItem[] }>("/api/stats/next-up", fetcher);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;

  const todayTasks = (goals ?? [])
    .flatMap((g) => g.tasks.map((t) => ({ ...t, goalTitle: g.title })))
    .filter((t) => t.status === "todo" && (!t.scheduledDate || t.scheduledDate <= todayStr))
    .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""))
    .slice(0, 8);

  const goal = settings?.dailyGoalMinutes ?? 30;
  const todayMinutes = overview?.todayMinutes ?? 0;
  const goalPct = Math.min(100, Math.round((todayMinutes / goal) * 100));
  const goalReached = todayMinutes >= goal;
  const nextUpItems = nextUpData?.items ?? [];

  async function toggleTask(id: string) {
    await api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status: "done" }) });
    mutateGoals();
  }

  async function changeGoal(minutes: number) {
    await api("/api/settings", { method: "PUT", body: JSON.stringify({ dailyGoalMinutes: minutes }) });
    mutateSettings();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">你好，欢迎回来 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {today.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}
          {overview ? ` · 已连续学习 ${overview.streakDays} 天` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="完成率" value={`${overview?.completionRate ?? 0}%`} sub="知识点掌握程度" icon={CheckCircle2} />
        <StatCard label="连续学习" value={`${overview?.streakDays ?? 0} 天`} sub="不间断打卡" icon={Flame} />
        <StatCard label="今日时长" value={`${overview?.todayMinutes ?? 0} 分钟`} sub="今天已投入" icon={Clock} />
        <StatCard label="累计时长" value={`${overview?.totalMinutes ?? 0} 分钟`} sub="历史总投入" icon={Hourglass} />
      </div>

      {/* 今日目标：每日学习时长激励（目标可在 15/30/60/90 分钟间调整） */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 gap-3">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              今日目标
            </CardTitle>
            <CardDescription>
              {goalReached ? "已达成，继续保持！" : `还差 ${goal - todayMinutes} 分钟达标`}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {(settings?.dailyGoalOptions ?? [15, 30, 60, 90]).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={goal === m ? "default" : "outline"}
                onClick={() => changeGoal(m)}
              >
                {m}分
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">今日已学习</span>
            <span className="font-medium tabular-nums">
              {todayMinutes} / {goal} 分钟
            </span>
          </div>
          <Progress value={goalPct} />
          {goalReached && <p className="text-xs font-medium text-emerald-600">🎉 目标达成，打卡成功！</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>知识点掌握进度</CardTitle>
            <CardDescription>
              共 {overview?.kpTotal ?? 0} 个知识点 · 已掌握 {overview?.mastered ?? 0} 个
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompletionRing
              mastered={overview?.mastered ?? 0}
              learning={overview?.learning ?? 0}
              notStarted={overview?.notStarted ?? 0}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>学习热力图</CardTitle>
            <CardDescription>近 15 周每日学习时长（分钟）</CardDescription>
          </CardHeader>
          <CardContent>
            <StudyHeatmap data={heatmap ?? []} />
          </CardContent>
        </Card>
      </div>

      {/* 今日下一步：到期待复习 / 薄弱点 / 前置已解锁新知识 的统一优先级队列 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-muted-foreground" />
            今日下一步
          </CardTitle>
          <CardDescription>按优先级合并：到期待复习 · 薄弱点 · 前置已解锁的新知识</CardDescription>
        </CardHeader>
        <CardContent>
          {!nextUpData ? (
            <p className="py-4 text-center text-sm text-muted-foreground">加载中…</p>
          ) : nextUpItems.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              🎉 今天没有待办。去「学习」页标记进度、给知识点设置前置，或到「复习」页完成复习。
            </p>
          ) : (
            <ul className="divide-y">
              {nextUpItems.map((it) => {
                const Icon = KIND_ICON[it.kind];
                return (
                  <li key={`${it.kind}:${it.id}`} className="flex items-center gap-3 py-2.5">
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md", KIND_STYLE[it.kind])}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{it.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{it.subtitle}</p>
                    </div>
                    <Link href={it.href} className="shrink-0 text-xs font-medium text-primary hover:underline">
                      去处理
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              今日任务
            </CardTitle>
            <CardDescription>今天或逾期未完成的任务</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/learn">管理目标与计划</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {todayTasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              今天没有待办任务，去「学习」页拆解一个吧
            </p>
          ) : (
            <ul className="divide-y">
              {todayTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <button
                    onClick={() => toggleTask(t.id)}
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors hover:border-primary hover:bg-primary/10"
                    aria-label="标记完成"
                  >
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.goalTitle} · 预计 {t.estimatedMinutes} 分钟
                    </p>
                  </div>
                  {t.scheduledDate && <Badge variant="muted">{t.scheduledDate.slice(5)}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
