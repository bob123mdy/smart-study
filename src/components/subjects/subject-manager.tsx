"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Sparkles, Trash2 } from "lucide-react";

type KpStatus = "not_started" | "learning" | "mastered";
type KP = { id: string; name: string; status: KpStatus; mastery: number };
type Chapter = { id: string; name: string; knowledgePoints: KP[] };
type Subject = { id: string; name: string; color: string; description: string | null; chapters: Chapter[] };

const STATUSES = [
  { value: "not_started", label: "未开始", active: "bg-muted text-muted-foreground" },
  { value: "learning", label: "学习中", active: "bg-amber-100 text-amber-800" },
  { value: "mastered", label: "已掌握", active: "bg-emerald-100 text-emerald-800" },
] as const;

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function AddSubjectDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/api/subjects", { method: "POST", body: JSON.stringify({ name, color }) });
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
          <DialogTitle>新建科目</DialogTitle>
          <DialogDescription>例如「高等数学」「英语」</DialogDescription>
        </DialogHeader>
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
                  className={cn(
                    "h-7 w-7 rounded-full ring-offset-2",
                    color === c && "ring-2 ring-ring",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`选择颜色 ${c}`}
                />
              ))}
            </div>
          </div>
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

function GenerateSubjectDialog({
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

  async function submit() {
    if (!bookName.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ ok: boolean; reason?: string }>("/api/subjects/generate", {
        method: "POST",
        body: JSON.stringify({ bookName }),
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
          <DialogTitle>从书名智能生成</DialogTitle>
          <DialogDescription>输入一本书名，自动生成科目、章节与知识点（需配置 AI Key）</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>书名</Label>
          <Input
            value={bookName}
            onChange={(e) => setBookName(e.target.value)}
            placeholder="例如「高等数学」"
          />
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

export function SubjectManager() {
  const { data: subjects, mutate } = useSWR<Subject[]>("/api/subjects", fetcher);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSubject, setShowSubject] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showChapter, setShowChapter] = useState(false);
  const [showKp, setShowKp] = useState<string | null>(null);

  const active = (subjects ?? []).find((s) => s.id === selectedId) ?? (subjects ?? [])[0];

  async function setKpStatus(kpId: string, status: KpStatus) {
    await api(`/api/knowledge-points/${kpId}`, { method: "PATCH", body: JSON.stringify({ status }) });
    mutate();
  }

  async function delKp(kpId: string) {
    if (!confirm("确定删除这个知识点吗？")) return;
    await api(`/api/knowledge-points/${kpId}`, { method: "DELETE" });
    mutate();
  }
  async function delChapter(id: string) {
    if (!confirm("确定删除这个章节吗？其下知识点将一并删除。")) return;
    await api(`/api/chapters/${id}`, { method: "DELETE" });
    mutate();
  }
  async function delSubject(id: string) {
    if (!confirm("确定删除这个科目吗？其下章节与知识点将一并删除。")) return;
    await api(`/api/subjects/${id}`, { method: "DELETE" });
    setSelectedId(null);
    mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">科目与知识点</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            三级结构：科目 → 章节 → 知识点。点击知识点状态即可更新掌握度。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowGenerate(true)}>
            <Sparkles className="h-4 w-4" /> 智能生成
          </Button>
          <Button onClick={() => setShowSubject(true)}>
            <Plus className="h-4 w-4" /> 新建科目
          </Button>
        </div>
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
        <div className="grid gap-4 lg:grid-cols-3">
          {/* 科目列表 */}
          <div className="space-y-2">
            {subjects.map((s) => {
              const total = s.chapters.reduce((n, c) => n + c.knowledgePoints.length, 0);
              const mastered = s.chapters.reduce(
                (n, c) => n + c.knowledgePoints.filter((k) => k.status === "mastered").length,
                0,
              );
              const isActive = active?.id === s.id;
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
                      {mastered}/{total} 已掌握
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

          {/* 章节 + 知识点 */}
          <div className="space-y-4 lg:col-span-2">
            {active && (
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{active.name}</h2>
                <Button variant="outline" size="sm" onClick={() => setShowChapter(true)}>
                  <Plus className="h-4 w-4" /> 添加章节
                </Button>
              </div>
            )}

            {active?.chapters.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  该科目还没有章节，点击「添加章节」
                </CardContent>
              </Card>
            )}

            {active?.chapters.map((ch) => (
              <Card key={ch.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">{ch.name}</CardTitle>
                  <div className="flex items-center gap-1">
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
                      {ch.knowledgePoints.map((kp) => (
                        <li key={kp.id} className="flex items-center gap-3 py-2">
                          <span className="min-w-0 flex-1 truncate text-sm">{kp.name}</span>
                          <div className="flex shrink-0 items-center gap-1">
                            <div className="flex items-center rounded-md border p-0.5">
                              {STATUSES.map((st) => (
                                <button
                                  key={st.value}
                                  onClick={() => setKpStatus(kp.id, st.value)}
                                  className={cn(
                                    "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                                    kp.status === st.value
                                      ? st.active
                                      : "text-muted-foreground hover:bg-accent",
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
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <AddSubjectDialog open={showSubject} onClose={() => setShowSubject(false)} onDone={mutate} />
      <GenerateSubjectDialog open={showGenerate} onClose={() => setShowGenerate(false)} onDone={mutate} />
      <AddChapterDialog
        open={showChapter && !!active}
        subjectId={active?.id ?? ""}
        onClose={() => setShowChapter(false)}
        onDone={mutate}
      />
      <AddKpDialog
        open={!!showKp}
        chapterId={showKp ?? ""}
        onClose={() => setShowKp(null)}
        onDone={mutate}
      />
    </div>
  );
}
