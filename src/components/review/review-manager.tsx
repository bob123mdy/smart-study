"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/api";
import { REVIEW_GRADES, formatInterval } from "@/lib/review-grades";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, BarChart3, BookOpen, History, Target } from "lucide-react";

interface QueueItem {
  type: "knowledge_point" | "wrong_question";
  id: string;
  title: string;
  subtitle: string | null;
  stability: number;
  difficulty: number;
  repetitions: number;
  intervalDays: number;
}
interface Queue {
  kps: QueueItem[];
  wqs: QueueItem[];
  total: number;
}
interface ReviewLog {
  id: string;
  targetType: string;
  targetName: string;
  quality: number;
  intervalDays: number;
  reviewedAt: string;
}
interface Settings {
  retention: number;
}
interface ForecastDay {
  date: string;
  label: string;
  due: number;
}
interface Forecast {
  days: ForecastDay[];
}

const RETENTION = [0.85, 0.9, 0.95];

const keyOf = (it: QueueItem) => `${it.type}:${it.id}`;

// FSRS 记忆稳定度：约等于「90% 概率仍记得」的天数；未满 1 天视为新学
const stabilityLabel = (s: number) => (s >= 1 ? formatInterval(Math.round(s)) : "新学");

export function ReviewManager() {
  const { data: queue, mutate } = useSWR<Queue>("/api/review/queue", fetcher);
  const { data: logs, mutate: mutateLogs } = useSWR<ReviewLog[]>("/api/review/logs", fetcher);
  const { data: settings, mutate: mutateSettings } = useSWR<Settings>("/api/settings", fetcher);
  const { data: forecast } = useSWR<Forecast>("/api/review/forecast", fetcher);

  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const retention = settings?.retention ?? 0.9;
  const maxDue = Math.max(...(forecast?.days ?? []).map((d) => d.due), 1);

  async function grade(item: QueueItem, quality: number) {
    const key = keyOf(item);
    setBusy((prev) => new Set(prev).add(key));
    try {
      await api("/api/review", {
        method: "POST",
        body: JSON.stringify({ targetType: item.type, targetId: item.id, quality }),
      });
      mutate();
      mutateLogs();
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function changeRetention(v: number) {
    await api("/api/settings", { method: "PUT", body: JSON.stringify({ retention: v }) });
    mutateSettings();
  }

  function toggle(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const renderItem = (item: QueueItem, icon: "kp" | "wq") => {
    const key = keyOf(item);
    const isBusy = busy.has(key);
    const isOpen = revealed.has(key);
    const hasAnswer = !!item.subtitle;
    return (
      <div key={key} className="rounded-md border p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-muted-foreground">
            {icon === "kp" ? <BookOpen className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <button
              onClick={() => toggle(key)}
              className="block w-full text-left text-sm font-medium hover:underline"
            >
              {item.title}
            </button>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="muted">间隔 {formatInterval(item.intervalDays)}</Badge>
              <Badge variant="outline">稳定度 {stabilityLabel(item.stability)}</Badge>
              <span>已复习 {item.repetitions} 次</span>
            </div>
            {isOpen && (
              <div className="mt-3 space-y-3">
                <p className="whitespace-pre-wrap rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
                  {hasAnswer ? item.subtitle : "（无答案说明，请凭记忆复述后自评）"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {REVIEW_GRADES.map((g) => (
                    <button
                      key={g.value}
                      onClick={() => grade(item, g.value)}
                      disabled={isBusy}
                      title={`${g.label}（评分 ${g.value}）`}
                      className="rounded-md border px-2 py-1.5 text-sm transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {g.emoji}
                      <span className="ml-1 hidden sm:inline">{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => toggle(key)}>
            {isOpen ? "收起" : "显示答案"}
          </Button>
        </div>
      </div>
    );
  };

  const kps = queue?.kps ?? [];
  const wqs = queue?.wqs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">间隔复习</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            基于 FSRS：先回忆 → 翻答案 → 自评。评分决定下次复习间隔。
          </p>
        </div>

        {/* 目标保留率（越高复习越勤） */}
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">目标保留率</span>
          <div className="flex gap-1">
            {RETENTION.map((v) => (
              <Button
                key={v}
                size="sm"
                variant={retention === v ? "default" : "outline"}
                onClick={() => changeRetention(v)}
              >
                {Math.round(v * 100)}%
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* 未来 7 天复习量 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <BarChart3 className="mr-1 inline h-4 w-4" /> 未来 7 天复习量
          </CardTitle>
          <CardDescription>按当前排期预计（知识点 + 错题）</CardDescription>
        </CardHeader>
        <CardContent>
          {!forecast ? (
            <p className="py-4 text-center text-sm text-muted-foreground">加载中…</p>
          ) : (
            <div className="flex h-32 items-end gap-1.5">
              {forecast.days.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-xs tabular-nums text-muted-foreground">{d.due || ""}</span>
                  <div
                    className={cn("w-full rounded-t-sm", d.due > 0 ? "bg-primary" : "bg-muted")}
                    style={{ height: `${Math.max((d.due / maxDue) * 72, d.due ? 6 : 3)}px` }}
                  />
                  <span className="whitespace-nowrap text-[10px] text-muted-foreground">{d.label}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 待复习队列 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            今日待复习
            <span className="ml-2 text-sm font-normal text-muted-foreground">{queue?.total ?? 0} 项</span>
          </CardTitle>
          <CardDescription>
            先回忆，再点「显示答案」对照，最后自评。知识点需标记为「学习中 / 已掌握」才会进入复习；错题标记「已掌握」后不再出现。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!queue ? (
            <p className="py-6 text-center text-sm text-muted-foreground">加载中…</p>
          ) : queue.total === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              🎉 今日没有待复习项。去「科目与知识点」标记学习进度，或到「错题本」记录错题。
            </p>
          ) : (
            <>
              {kps.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">知识点（{kps.length}）</div>
                  {kps.map((k) => renderItem(k, "kp"))}
                </div>
              )}
              {wqs.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">错题（{wqs.length}）</div>
                  {wqs.map((w) => renderItem(w, "wq"))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 复习历史 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <History className="mr-1 inline h-4 w-4" /> 最近复习
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!logs ? (
            <p className="py-4 text-center text-sm text-muted-foreground">加载中…</p>
          ) : logs.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">还没有复习记录</p>
          ) : (
            <ul className="divide-y">
              {logs.map((l) => {
                const grade = REVIEW_GRADES.find((g) => g.value === l.quality);
                return (
                  <li key={l.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {l.targetType === "knowledge_point" ? "📖" : "⚠️"} {l.targetName}
                    </span>
                    <Badge variant="muted">{grade?.emoji ?? ""} {grade?.label ?? l.quality}</Badge>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      → {formatInterval(l.intervalDays)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(l.reviewedAt).toLocaleString("zh-CN", { hour12: false })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
