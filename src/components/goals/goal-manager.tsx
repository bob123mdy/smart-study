"use client";

import { useState } from "react";
import useSWR from "swr";
import { addDays, format } from "date-fns";
import { api, fetcher } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, ChevronDown, Plus, Sparkles, Trash2 } from "lucide-react";

interface Milestone {
  id: string;
  goalId: string;
  title: string;
  sortOrder: number;
  targetDate: string | null;
  status: string;
}
interface Task {
  id: string;
  goalId: string;
  milestoneId: string | null;
  title: string;
  scheduledDate: string | null;
  estimatedMinutes: number;
  status: string;
}
interface Goal {
  id: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  startDate: string | null;
  targetDate: string | null;
  status: string;
  progress: number;
  doneTasks: number;
  totalTasks: number;
  timeProgress: number;
  pace: "idle" | "ahead" | "behind" | "on_track";
  milestones: Milestone[];
  tasks: Task[];
}
interface SubjectOption {
  id: string;
  name: string;
}

const PACE: Record<Goal["pace"], { label: string; variant: "muted" | "success" | "destructive" | "secondary" }> = {
  idle: { label: "未拆解", variant: "muted" },
  ahead: { label: "超前", variant: "success" },
  behind: { label: "落后", variant: "destructive" },
  on_track: { label: "正常", variant: "secondary" },
};

function GenerateGoalDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [bookName, setBookName] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [targetDate, setTargetDate] = useState(format(addDays(new Date(), 90), "yyyy-MM-dd"));
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!bookName.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ ok: boolean; reason?: string }>("/api/goals/generate", {
        method: "POST",
        body: JSON.stringify({ bookName, startDate, targetDate: targetDate || null }),
      });
      if (!r.ok) {
        alert(r.reason ?? "生成失败");
        return;
      }
      onDone();
      onClose();
      setBookName("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "生成失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>从书名生成计划</DialogTitle>
          <DialogDescription>
            输入书名，自动生成科目、章节、知识点、里程碑与每日任务（需配置 AI Key）
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>书名</Label>
            <Input
              value={bookName}
              onChange={(e) => setBookName(e.target.value)}
              placeholder="例如「线性代数」"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>开始日期</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>目标日期</Label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={busy || !bookName.trim()}>
            {busy ? "生成中…" : "生成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateGoalDialog({
  open,
  subjects,
  onClose,
  onDone,
}: {
  open: boolean;
  subjects: SubjectOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [targetDate, setTargetDate] = useState(format(addDays(new Date(), 90), "yyyy-MM-dd"));
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          title,
          subjectId: subjectId || null,
          startDate,
          targetDate: targetDate || null,
        }),
      });
      onDone();
      onClose();
      setTitle("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建长期目标</DialogTitle>
          <DialogDescription>选择科目后，可一键按模板拆解为里程碑与每日任务</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>目标</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如「3个月学完线性代数」" />
          </div>
          <div className="space-y-2">
            <Label>关联科目（可选）</Label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">不关联科目</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>开始日期</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>目标日期</Label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={busy || !title.trim()}>
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GoalManager() {
  const { data: goals, mutate } = useSWR<Goal[]>("/api/goals", fetcher);
  const { data: subjects } = useSWR<SubjectOption[]>("/api/subjects", fetcher);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  const activeExpanded = expandedId ?? goals?.[0]?.id ?? null;

  async function toggleTask(id: string, next: string) {
    await api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    mutate();
  }
  async function toggleMilestone(id: string, next: string) {
    await api(`/api/milestones/${id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    mutate();
  }
  async function delTask(id: string) {
    if (!confirm("删除该任务？")) return;
    await api(`/api/tasks/${id}`, { method: "DELETE" });
    mutate();
  }
  async function delMilestone(id: string) {
    if (!confirm("删除该里程碑？")) return;
    await api(`/api/milestones/${id}`, { method: "DELETE" });
    mutate();
  }
  async function delGoal(id: string) {
    if (!confirm("删除该目标及其里程碑、任务？")) return;
    await api(`/api/goals/${id}`, { method: "DELETE" });
    mutate();
  }
  async function decompose(id: string) {
    try {
      await api(`/api/goals/${id}/decompose`, { method: "POST" });
      mutate();
    } catch (e) {
      alert(e instanceof Error ? e.message : "拆解失败");
    }
  }
  async function addMilestone(id: string, title: string) {
    await api(`/api/goals/${id}/milestones`, { method: "POST", body: JSON.stringify({ title }) });
    mutate();
  }
  async function addTask(id: string, title: string, scheduledDate: string) {
    await api(`/api/goals/${id}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title, scheduledDate: scheduledDate || null }),
    });
    mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">目标与计划</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            长期目标 → 里程碑 → 每日任务，进度与时间对照显示「超前 / 落后」
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowGenerate(true)}>
            <Sparkles className="h-4 w-4" /> 从书名生成计划
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> 新建目标
          </Button>
        </div>
      </div>

      {!goals ? (
        <p className="py-16 text-center text-sm text-muted-foreground">加载中…</p>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            还没有目标，点击右上角「新建目标」开始
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {goals.map((g) => {
            const pace = PACE[g.pace];
            const expanded = activeExpanded === g.id;
            const milestoneName = new Map(g.milestones.map((m) => [m.id, m.title]));
            return (
              <Card key={g.id}>
                <CardHeader className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : g.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{g.title}</CardTitle>
                        <Badge variant={pace.variant}>{pace.label}</Badge>
                      </div>
                      <CardDescription className="mt-1">
                        {g.startDate && g.targetDate
                          ? `${g.startDate} ~ ${g.targetDate}`
                          : "未设置日期"}
                      </CardDescription>
                    </div>
                    <ChevronDown
                      className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Progress value={Math.round(g.progress * 100)} className="flex-1" />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {g.doneTasks}/{g.totalTasks} 任务 · {Math.round(g.progress * 100)}%
                    </span>
                  </div>
                </CardHeader>

                {expanded && (
                  <CardContent className="space-y-5">
                    {g.totalTasks === 0 && (
                      <div className="flex items-center justify-between rounded-lg border border-dashed p-3">
                        <p className="text-sm text-muted-foreground">
                          {g.subjectId ? "已关联科目，可一键按模板拆解" : "未关联科目，请手动添加里程碑/任务"}
                        </p>
                        {g.subjectId && (
                          <Button size="sm" onClick={() => decompose(g.id)}>
                            <Sparkles className="h-4 w-4" /> 模板拆解
                          </Button>
                        )}
                      </div>
                    )}

                    <section>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-muted-foreground">里程碑</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const t = prompt("里程碑标题");
                            if (t?.trim()) addMilestone(g.id, t.trim());
                          }}
                        >
                          <Plus className="h-4 w-4" /> 添加
                        </Button>
                      </div>
                      {g.milestones.length === 0 ? (
                        <p className="text-xs text-muted-foreground">暂无里程碑</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {g.milestones.map((m) => (
                            <li key={m.id} className="flex items-center gap-2 rounded-md border p-2">
                              <button
                                onClick={() => toggleMilestone(m.id, m.status === "done" ? "pending" : "done")}
                                className={cn(
                                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                                  m.status === "done" ? "bg-emerald-500 text-white" : "hover:border-primary",
                                )}
                              >
                                {m.status === "done" && <Check className="h-3.5 w-3.5" />}
                              </button>
                              <span
                                className={cn(
                                  "flex-1 text-sm",
                                  m.status === "done" && "text-muted-foreground line-through",
                                )}
                              >
                                {m.title}
                              </span>
                              {m.targetDate && (
                                <span className="text-xs text-muted-foreground">{m.targetDate}</span>
                              )}
                              <button
                                onClick={() => delMilestone(m.id)}
                                className="rounded p-1 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <section>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-muted-foreground">每日任务</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const t = prompt("任务标题");
                            const d = prompt("计划日期（YYYY-MM-DD，可留空）");
                            if (t?.trim()) addTask(g.id, t.trim(), d?.trim() ?? "");
                          }}
                        >
                          <Plus className="h-4 w-4" /> 添加
                        </Button>
                      </div>
                      {g.tasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground">暂无任务</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {g.tasks.map((t) => (
                            <li key={t.id} className="flex items-center gap-2 rounded-md border p-2">
                              <button
                                onClick={() => toggleTask(t.id, t.status === "done" ? "todo" : "done")}
                                className={cn(
                                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                                  t.status === "done" ? "bg-emerald-500 text-white" : "hover:border-primary",
                                )}
                              >
                                {t.status === "done" && <Check className="h-3.5 w-3.5" />}
                              </button>
                              <span
                                className={cn(
                                  "min-w-0 flex-1 truncate text-sm",
                                  t.status === "done" && "text-muted-foreground line-through",
                                )}
                              >
                                {t.title}
                              </span>
                              {t.milestoneId && (
                                <span className="hidden text-xs text-muted-foreground sm:inline">
                                  {milestoneName.get(t.milestoneId)}
                                </span>
                              )}
                              {t.scheduledDate && (
                                <span className="text-xs text-muted-foreground">{t.scheduledDate.slice(5)}</span>
                              )}
                              <button
                                onClick={() => delTask(t.id)}
                                className="rounded p-1 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => delGoal(g.id)}>
                        <Trash2 className="h-4 w-4" /> 删除目标
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <CreateGoalDialog
        open={showCreate}
        subjects={subjects ?? []}
        onClose={() => setShowCreate(false)}
        onDone={mutate}
      />
      <GenerateGoalDialog open={showGenerate} onClose={() => setShowGenerate(false)} onDone={mutate} />
    </div>
  );
}
