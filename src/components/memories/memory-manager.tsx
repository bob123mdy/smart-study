"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/api";
import {
  MEMORY_CATEGORIES,
  MEMORY_CATEGORY_EMOJI,
  MEMORY_CATEGORY_LABELS,
} from "@/lib/memories";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Archive, ArchiveRestore, Plus, Trash2 } from "lucide-react";

interface Memory {
  id: string;
  category: string;
  content: string;
  importance: number;
  source: string;
  archived: boolean;
  createdAt: string;
}

function impMeta(v: number) {
  if (v >= 0.7) return { label: `重要 ${Math.round(v * 100)}%`, variant: "success" as const };
  if (v >= 0.4) return { label: `一般 ${Math.round(v * 100)}%`, variant: "secondary" as const };
  return { label: `次要 ${Math.round(v * 100)}%`, variant: "muted" as const };
}

export function MemoryManager() {
  const { data: memories, mutate } = useSWR<Memory[]>("/api/memories", fetcher);

  const [newCategory, setNewCategory] = useState("weak_point");
  const [newContent, setNewContent] = useState("");
  const [newImportance, setNewImportance] = useState(0.5);
  const [busy, setBusy] = useState(false);

  const active = (memories ?? []).filter((m) => !m.archived);
  const archived = (memories ?? []).filter((m) => m.archived);

  async function add() {
    if (!newContent.trim()) return;
    setBusy(true);
    try {
      await api("/api/memories", {
        method: "POST",
        body: JSON.stringify({ category: newCategory, content: newContent.trim(), importance: newImportance }),
      });
      setNewContent("");
      mutate();
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive(m: Memory) {
    await api(`/api/memories/${m.id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: !m.archived }),
    });
    mutate();
  }

  async function del(id: string) {
    if (!confirm("删除这条记忆？")) return;
    await api(`/api/memories/${id}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">长期记忆</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          记录薄弱点、易错类型、偏好与作息，AI 老师会据此个性化回答。你可随时查看、编辑或归档。
        </p>
      </div>

      {/* 新增 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">记录一条记忆</CardTitle>
          <CardDescription>例如「行列式展开时容易漏掉符号」→ 易错类型</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {MEMORY_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
            <select
              value={String(newImportance)}
              onChange={(e) => setNewImportance(Number(e.target.value))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="0.2">重要度：低</option>
              <option value="0.5">重要度：中</option>
              <option value="0.8">重要度：高</option>
            </select>
          </div>
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="记录内容…"
          />
          <Button onClick={add} disabled={busy || !newContent.trim()}>
            <Plus className="h-4 w-4" /> 保存记忆
          </Button>
        </CardContent>
      </Card>

      {/* 分类展示 */}
      {!memories ? (
        <p className="py-10 text-center text-sm text-muted-foreground">加载中…</p>
      ) : active.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">还没有记忆，先从上面记录一条吧</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {MEMORY_CATEGORIES.map((cat) => {
            const items = active.filter((m) => m.category === cat.value);
            if (items.length === 0) return null;
            return (
              <Card key={cat.value}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {cat.emoji} {cat.label}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">{items.length}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.map((m) => {
                    const imp = impMeta(m.importance);
                    return (
                      <div key={m.id} className="group rounded-md border p-3">
                        <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <Badge variant={imp.variant}>{imp.label}</Badge>
                          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => toggleArchive(m)}
                              className="rounded p-1 text-muted-foreground hover:text-foreground"
                              title="归档"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => del(m.id)}
                              className="rounded p-1 text-muted-foreground hover:text-destructive"
                              title="删除"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 已归档 */}
      {archived.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">已归档（{archived.length}）</CardTitle>
            <CardDescription>归档后不再注入 AI 画像，可随时恢复</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {archived.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-md border border-dashed p-2">
                <span className="shrink-0">{MEMORY_CATEGORY_EMOJI[m.category]}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{m.content}</span>
                <Badge variant="muted">{MEMORY_CATEGORY_LABELS[m.category]}</Badge>
                <button
                  onClick={() => toggleArchive(m)}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                  title="恢复"
                >
                  <ArchiveRestore className="h-4 w-4" />
                </button>
                <button
                  onClick={() => del(m.id)}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  title="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
