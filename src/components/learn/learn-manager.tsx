"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { addDays, format } from "date-fns";
import { api, fetcher } from "@/lib/api";
import { catalogSummary } from "@/lib/open-textbooks";
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
import { BookOpen, Check, ChevronDown, Dumbbell, GraduationCap, Link2, Plus, Sparkles, Trash2 } from "lucide-react";

type KpStatus = "not_started" | "learning" | "mastered";
interface KP {
  id: string;
  name: string;
  status: KpStatus;
  mastery: number;
  prerequisites: string[];
}
interface Chapter {
  id: string;
  name: string;
  knowledgePoints: KP[];
}
interface Subject {
  id: string;
  name: string;
  color: string;
  description: string | null;
  chapters: Chapter[];
}

interface Milestone {
  id: string;
  title: string;
  sortOrder: number;
  targetDate: string | null;
  status: string;
}
interface Task {
  id: string;
  milestoneId: string | null;
  knowledgePointId: string | null;
  title: string;
  scheduledDate: string | null;
  status: string;
}
interface Goal {
  id: string;
  title: string;
  subjectId: string | null;
  startDate: string | null;
  targetDate: string | null;
  progress: number;
  doneTasks: number;
  totalTasks: number;
  pace: "idle" | "ahead" | "behind" | "on_track";
  milestones: Milestone[];
  tasks: Task[];
}

const STATUSES = [
  { value: "not_started", label: "未开始", active: "bg-muted text-muted-foreground" },
  { value: "learning", label: "学习中", active: "bg-amber-100 text-amber-800" },
  { value: "mastered", label: "已掌握", active: "bg-emerald-100 text-emerald-800" },
] as const;

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const PACE: Record<Goal["pace"], { label: string; variant: "muted" | "success" | "destructive" | "secondary" }> = {
  idle: { label: "未拆解", variant: "muted" },
  ahead: { label: "超前", variant: "success" },
  behind: { label: "落后", variant: "destructive" },
  on_track: { label: "正常", variant: "secondary" },
};

interface OutlineSection {
  title: string;
  points: string[];
}
interface ReviewOutline {
  title: string;
  summary?: string;
  sections: OutlineSection[];
}

/** 章节复习大纲：可折叠缩进树（核心概念 → 子知识点）。 */
function OutlineTree({ sections }: { sections: OutlineSection[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <ul className="space-y-1.5">
      {sections.map((s) => {
        const isOpen = open[s.title] !== false;
        return (
          <li key={s.title} className="rounded-md border">
            <button
              onClick={() => setOpen((o) => ({ ...o, [s.title]: !isOpen }))}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-accent"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180",
                )}
              />
              <span className="min-w-0 flex-1">{s.title}</span>
            </button>
            {isOpen && (
              <ul className="space-y-1.5 border-t px-6 py-2.5">
                {s.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AddSubjectDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [bookName, setBookName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 手动兜底：无 AI 时创建空白科目
  const [manual, setManual] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [manualBusy, setManualBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setBookName("");
      setBusy(false);
      setResult(null);
      setError(null);
      setManual(false);
      setName("");
      setColor(COLORS[0]);
    }
  }, [open]);

  const books = catalogSummary();

  async function generate() {
    if (!bookName.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<{
        ok: boolean;
        subjectName?: string;
        chapterCount?: number;
        knowledgePointCount?: number;
        reason?: string;
      }>("/api/subjects/generate", {
        method: "POST",
        body: JSON.stringify({ bookName: bookName.trim() }),
      });
      if (!r.ok) {
        setError(r.reason ?? "生成失败，请重试");
        return;
      }
      onDone();
      setResult(
        `已生成《${r.subjectName ?? bookName.trim()}》：${r.chapterCount ?? 0} 章 · ${
          r.knowledgePointCount ?? 0
        } 个知识点。稍后自动关闭，点章节「学习」即可让老师带学。`,
      );
      window.setTimeout(() => onClose(), 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  async function importCatalog(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<{
        ok: boolean;
        subjectName?: string;
        chapterCount?: number;
        knowledgePointCount?: number;
        reason?: string;
      }>("/api/subjects/catalog", { method: "POST", body: JSON.stringify({ id }) });
      if (!r.ok) {
        setError(r.reason ?? "导入失败，请重试");
        return;
      }
      onDone();
      setResult(
        `已导入《${r.subjectName ?? ""}》：${r.chapterCount ?? 0} 章 · ${
          r.knowledgePointCount ?? 0
        } 个知识点。稍后自动关闭。`,
      );
      window.setTimeout(() => onClose(), 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  async function submitManual() {
    if (!name.trim()) return;
    setManualBusy(true);
    try {
      await api("/api/subjects", { method: "POST", body: JSON.stringify({ name, color }) });
      onDone();
      onClose();
    } finally {
      setManualBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建科目</DialogTitle>
          <DialogDescription>输入课本名，自动生成整本书的章节与知识点，直接开始学习</DialogDescription>
        </DialogHeader>

        {!manual ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>课本名称</Label>
              <Input
                value={bookName}
                onChange={(e) => setBookName(e.target.value)}
                placeholder="例如「高等数学」「线性代数」"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {result && (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {result}
              </p>
            )}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">或从开放教材目录导入（离线可用）</Label>
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-1.5">
                {books.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    disabled={busy}
                    onClick={() => importCatalog(b.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{b.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {b.source} · {b.chapterCount} 章 · {b.knowledgePointCount} 知识点
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-primary">导入</span>
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setManual(true)}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              无 AI 或想自定义？手动创建空白科目
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>科目名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="科目名称" />
            </div>
            <div className="space-y-2">
              <Label>颜色</Label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn("h-7 w-7 rounded-full ring-offset-2", color === c && "ring-2 ring-ring")}
                    style={{ backgroundColor: c }}
                    aria-label={`选择颜色 ${c}`}
                  />
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setManual(false)}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              ← 返回按课本生成
            </button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          {!manual ? (
            <Button onClick={generate} disabled={busy || !bookName.trim()}>
              {busy ? "生成中…" : "生成整本教材"}
            </Button>
          ) : (
            <Button onClick={submitManual} disabled={manualBusy || !name.trim()}>
              {manualBusy ? "创建中…" : "创建"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddChapterDialog({
  open,
  subjectId,
  onClose,
  onDone,
}: {
  open: boolean;
  subjectId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/api/chapters", { method: "POST", body: JSON.stringify({ subjectId, name }) });
      onDone();
      onClose();
      setName("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建章节</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>章节名称</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如「第1章 行列式」" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddKpDialog({
  open,
  chapterId,
  onClose,
  onDone,
}: {
  open: boolean;
  chapterId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/api/knowledge-points", { method: "POST", body: JSON.stringify({ chapterId, name }) });
      onDone();
      onClose();
      setName("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建知识点</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>知识点名称</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如「行列式的性质」" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateGoalDialog({
  open,
  subjectId,
  subjectName,
  onClose,
  onDone,
}: {
  open: boolean;
  subjectId: string;
  subjectName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [targetDate, setTargetDate] = useState(format(addDays(new Date(), 90), "yyyy-MM-dd"));
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api("/api/goals", {
        method: "POST",
        body: JSON.stringify({ title, subjectId, startDate, targetDate: targetDate || null }),
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
          <DialogDescription>关联科目「{subjectName}」，创建后可一键按模板拆解</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>目标</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如「3个月学完线性代数」" />
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

function PrereqDialog({
  kpName,
  options,
  initial,
  onClose,
  onDone,
}: {
  kpName: string;
  options: { id: string; name: string; status: KpStatus }[];
  initial: string[];
  onClose: () => void;
  onDone: (ids: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  async function submit() {
    setBusy(true);
    try {
      await onDone([...selected]);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>前置知识点</DialogTitle>
          <DialogDescription>「{kpName}」应先掌握哪些知识点？未掌握的前置会以琥珀色提醒。</DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {options.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">没有其它知识点可设置</p>
          ) : (
            options.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selected.has(o.id)}
                  onChange={() => toggle(o.id)}
                  className="h-4 w-4 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate text-sm">{o.name}</span>
                <span
                  className={cn("shrink-0 text-xs", o.status === "mastered" ? "text-emerald-600" : "text-amber-600")}
                >
                  {o.status === "mastered" ? "已掌握" : "未掌握"}
                </span>
              </label>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={busy}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LearnManager() {
  const { data: subjects, mutate: mutateSubjects } = useSWR<Subject[]>("/api/subjects", fetcher);
  const { data: goals, mutate: mutateGoals } = useSWR<Goal[]>("/api/goals", fetcher);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [showSubject, setShowSubject] = useState(false);
  const [showChapter, setShowChapter] = useState(false);
  const [showKp, setShowKp] = useState<string | null>(null);
  const [showGoal, setShowGoal] = useState(false);
  const [review, setReview] = useState<{ chapterId: string; outline: ReviewOutline; loading: boolean } | null>(
    null,
  );
  const [editPrereq, setEditPrereq] = useState<{ kpId: string; kpName: string } | null>(null);

  const active = (subjects ?? []).find((s) => s.id === selectedId) ?? (subjects ?? [])[0];
  const subjectGoals = (goals ?? []).filter((g) => g.subjectId === active?.id);

  // 知识点 → 关联任务数（跨该科目所有目标）
  const kpTaskCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of goals ?? []) {
      for (const t of g.tasks) {
        if (t.knowledgePointId) map.set(t.knowledgePointId, (map.get(t.knowledgePointId) ?? 0) + 1);
      }
    }
    return map;
  }, [goals]);

  // 全部知识点扁平列表 + id 索引（用于解析前置知识点名称/状态）
  const allKps = useMemo(
    () => (subjects ?? []).flatMap((s) => s.chapters.flatMap((c) => c.knowledgePoints)),
    [subjects],
  );
  const kpById = useMemo(() => new Map(allKps.map((k) => [k.id, k])), [allKps]);

  async function setKpStatus(kpId: string, status: KpStatus) {
    await api(`/api/knowledge-points/${kpId}`, { method: "PATCH", body: JSON.stringify({ status }) });
    mutateSubjects();
  }
  async function savePrereq(kpId: string, ids: string[]) {
    await api(`/api/knowledge-points/${kpId}`, {
      method: "PATCH",
      body: JSON.stringify({ prerequisites: ids }),
    });
    mutateSubjects();
  }
  async function delKp(kpId: string) {
    if (!confirm("确定删除这个知识点吗？")) return;
    await api(`/api/knowledge-points/${kpId}`, { method: "DELETE" });
    mutateSubjects();
  }
  async function delChapter(id: string) {
    if (!confirm("确定删除这个章节吗？其下知识点将一并删除。")) return;
    await api(`/api/chapters/${id}`, { method: "DELETE" });
    mutateSubjects();
  }
  async function delSubject(id: string) {
    if (!confirm("确定删除这个科目吗？其下章节与知识点将一并删除。")) return;
    await api(`/api/subjects/${id}`, { method: "DELETE" });
    setSelectedId(null);
    mutateSubjects();
  }

  async function toggleTask(id: string, next: string) {
    await api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    mutateGoals();
  }
  async function toggleMilestone(id: string, next: string) {
    await api(`/api/milestones/${id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    mutateGoals();
  }
  async function delTask(id: string) {
    if (!confirm("删除该任务？")) return;
    await api(`/api/tasks/${id}`, { method: "DELETE" });
    mutateGoals();
  }
  async function delMilestone(id: string) {
    if (!confirm("删除该里程碑？")) return;
    await api(`/api/milestones/${id}`, { method: "DELETE" });
    mutateGoals();
  }
  async function delGoal(id: string) {
    if (!confirm("删除该目标及其里程碑、任务？")) return;
    await api(`/api/goals/${id}`, { method: "DELETE" });
    mutateGoals();
  }
  async function decompose(id: string) {
    try {
      await api(`/api/goals/${id}/decompose`, { method: "POST" });
      mutateGoals();
    } catch (e) {
      alert(e instanceof Error ? e.message : "拆解失败");
    }
  }
  async function addMilestone(id: string, title: string) {
    await api(`/api/goals/${id}/milestones`, { method: "POST", body: JSON.stringify({ title }) });
    mutateGoals();
  }
  async function addTask(id: string, title: string, scheduledDate: string) {
    await api(`/api/goals/${id}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title, scheduledDate: scheduledDate || null }),
    });
    mutateGoals();
  }

  async function doReview(chapterId: string) {
    setReview({ chapterId, outline: { title: "", summary: "", sections: [] }, loading: true });
    try {
      const r = await api<{ outline: ReviewOutline; markdown: string; conversationId: string }>(
        `/api/chapters/${chapterId}/review`,
        { method: "POST" },
      );
      setReview({ chapterId, outline: r.outline, loading: false });
    } catch (e) {
      alert(e instanceof Error ? e.message : "生成复习大纲失败");
      setReview(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">学习</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            科目 · 知识点 · 目标 · 计划，一处管理。点知识点状态更新掌握度，关联任务自动显示。
          </p>
        </div>
        <Button onClick={() => setShowSubject(true)}>
          <Plus className="h-4 w-4" /> 新建科目
        </Button>
      </div>

      {!subjects ? (
        <p className="py-16 text-center text-sm text-muted-foreground">加载中…</p>
      ) : subjects.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            还没有科目，点击右上角「新建科目」开始
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* 左列：科目列表 */}
          <div className="space-y-2">
            {subjects.map((s) => {
              const total = s.chapters.reduce((n, c) => n + c.knowledgePoints.length, 0);
              const mastered = s.chapters.reduce(
                (n, c) => n + c.knowledgePoints.filter((k) => k.status === "mastered").length,
                0,
              );
              const isActive = active?.id === s.id;
              const goalCount = (goals ?? []).filter((g) => g.subjectId === s.id).length;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                    isActive ? "border-primary bg-primary/5" : "bg-card hover:bg-accent",
                  )}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {mastered}/{total} 已掌握{goalCount > 0 ? ` · ${goalCount} 目标` : ""}
                    </span>
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      delSubject(s.id);
                    }}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </span>
                </button>
              );
            })}
          </div>

          {/* 右列：目标 + 章节知识点 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">目标与计划</h2>
              <Button variant="outline" size="sm" onClick={() => setShowGoal(true)}>
                <Plus className="h-4 w-4" /> 新建目标
              </Button>
            </div>

            {subjectGoals.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  该科目还没有目标。新建目标后可一键按模板拆解为里程碑与每日任务。
                </CardContent>
              </Card>
            ) : (
              subjectGoals.map((g) => {
                const pace = PACE[g.pace];
                const expanded = expandedGoalId === g.id;
                const milestoneName = new Map(g.milestones.map((m) => [m.id, m.title]));
                return (
                  <Card key={g.id}>
                    <CardHeader
                      className="cursor-pointer"
                      onClick={() => setExpandedGoalId(expanded ? null : g.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{g.title}</CardTitle>
                            <Badge variant={pace.variant}>{pace.label}</Badge>
                          </div>
                          <CardDescription className="mt-1">
                            {g.startDate && g.targetDate ? `${g.startDate} ~ ${g.targetDate}` : "未设置日期"}
                          </CardDescription>
                        </div>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                            expanded && "rotate-180",
                          )}
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
                            <p className="text-sm text-muted-foreground">已关联科目，可一键按模板拆解</p>
                            <Button size="sm" onClick={() => decompose(g.id)}>
                              <Sparkles className="h-4 w-4" /> 模板拆解
                            </Button>
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
              })
            )}

            <div className="flex items-center justify-between pt-2">
              <h2 className="font-semibold">章节与知识点</h2>
              <Button variant="outline" size="sm" onClick={() => setShowChapter(true)}>
                <Plus className="h-4 w-4" /> 添加章节
              </Button>
            </div>

            {review?.loading && (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  老师正在带练复习、生成思维导图…
                </CardContent>
              </Card>
            )}
            {review && !review.loading && (
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{review.outline.title || "章节复习大纲"}</CardTitle>
                    {review.outline.summary && (
                      <CardDescription className="mt-1">{review.outline.summary}</CardDescription>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setReview(null)}>
                    关闭
                  </Button>
                </CardHeader>
                <CardContent>
                  <OutlineTree sections={review.outline.sections} />
                </CardContent>
              </Card>
            )}

            {active?.chapters.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  该科目还没有章节，点击「添加章节」
                </CardContent>
              </Card>
            )}

            {active?.chapters.map((ch) => {
              const chDone =
                ch.knowledgePoints.length > 0 && ch.knowledgePoints.every((k) => k.status === "mastered");
              return (
              <Card key={ch.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">{ch.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/learn/teach?chapter=${ch.id}`}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      title="老师带你走完本章：规划 → 学习 → 考察 → 查缺补漏"
                    >
                      <GraduationCap className="h-3.5 w-3.5" /> 学习
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => doReview(ch.id)}
                      disabled={review?.loading && review.chapterId === ch.id}
                      title={chDone ? "本章已全部掌握，老师带你总体复习" : "老师带你梳理本章大纲"}
                    >
                      <Sparkles className="h-4 w-4" />
                      {review?.loading && review.chapterId === ch.id ? "生成中…" : "大纲"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowKp(ch.id)}>
                      <Plus className="h-4 w-4" /> 知识点
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => delChapter(ch.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {ch.knowledgePoints.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">暂无知识点</p>
                  ) : (
                    <ul className="divide-y">
                      {ch.knowledgePoints.map((kp) => {
                        const taskCount = kpTaskCount.get(kp.id) ?? 0;
                        const prereqs = kp.prerequisites ?? [];
                        const prereqMissing = prereqs.some((pid) => kpById.get(pid)?.status !== "mastered");
                        const prereqNames = prereqs.map((pid) => kpById.get(pid)?.name ?? "（已删除）").join("、");
                        return (
                          <li key={kp.id} className="flex flex-wrap items-center gap-3 py-2">
                            <span className="min-w-0 flex-1 truncate text-sm">{kp.name}</span>
                            {taskCount > 0 && (
                              <span
                                className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                                title="关联任务数"
                              >
                                📋 {taskCount}
                              </span>
                            )}
                            <Link
                              href={`/learn/teach?kp=${kp.id}`}
                              className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-primary hover:bg-primary/5"
                              title="让老师围绕该知识点互动教学"
                            >
                              <BookOpen className="h-3.5 w-3.5" /> 学习
                            </Link>
                            <Link
                              href={`/learn/practice?kp=${kp.id}`}
                              className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-primary hover:bg-primary/5"
                              title="围绕该知识点自动出题练习"
                            >
                              <Dumbbell className="h-3.5 w-3.5" /> 练习
                            </Link>
                            <button
                              onClick={() => setEditPrereq({ kpId: kp.id, kpName: kp.name })}
                              className={cn(
                                "flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                                prereqs.length
                                  ? prereqMissing
                                    ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : "text-muted-foreground hover:bg-accent",
                              )}
                              title={prereqs.length ? `前置：${prereqNames}` : "设置前置知识点"}
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              {prereqs.length ? `前置 ${prereqs.length}` : "前置"}
                            </button>
                            <div className="flex shrink-0 items-center gap-1">
                              <div className="flex items-center rounded-md border p-0.5">
                                {STATUSES.map((st) => (
                                  <button
                                    key={st.value}
                                    onClick={() => setKpStatus(kp.id, st.value)}
                                    className={cn(
                                      "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                                      kp.status === st.value ? st.active : "text-muted-foreground hover:bg-accent",
                                    )}
                                  >
                                    {st.label}
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => delKp(kp.id)}
                                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
              );
            })}
          </div>
        </div>
      )}

      {editPrereq && (
        <PrereqDialog
          key={editPrereq.kpId}
          kpName={editPrereq.kpName}
          options={allKps.filter((k) => k.id !== editPrereq.kpId)}
          initial={kpById.get(editPrereq.kpId)?.prerequisites ?? []}
          onClose={() => setEditPrereq(null)}
          onDone={(ids) => savePrereq(editPrereq.kpId, ids)}
        />
      )}
      <AddSubjectDialog open={showSubject} onClose={() => setShowSubject(false)} onDone={mutateSubjects} />
      <AddChapterDialog
        open={showChapter && !!active}
        subjectId={active?.id ?? ""}
        onClose={() => setShowChapter(false)}
        onDone={mutateSubjects}
      />
      <AddKpDialog
        open={!!showKp}
        chapterId={showKp ?? ""}
        onClose={() => setShowKp(null)}
        onDone={mutateSubjects}
      />
      <CreateGoalDialog
        open={showGoal && !!active}
        subjectId={active?.id ?? ""}
        subjectName={active?.name ?? ""}
        onClose={() => setShowGoal(false)}
        onDone={mutateGoals}
      />
    </div>
  );
}
