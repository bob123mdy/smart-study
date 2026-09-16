"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/api";
import { REVIEW_GRADES, formatInterval } from "@/lib/review-grades";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BookMarked,
  Brain,
  Flame,
  Import,
  Layers,
  Plus,
  Trash2,
  Volume2,
} from "lucide-react";

interface Book {
  id: string;
  name: string;
  description: string | null;
  isBuiltin: boolean;
  source: string;
  wordCount: number;
}
interface Progress {
  status: "new" | "learning" | "mastered";
  ef: number;
  repetitions: number;
  intervalDays: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  wrongCount: number;
}
interface WordItem {
  id: string;
  word: string;
  phonetic: string | null;
  meaning: string;
  example: string | null;
  exampleMeaning: string | null;
  sortOrder: number;
  progress: Progress | null;
}
interface Stats {
  total: number;
  new: number;
  learning: number;
  mastered: number;
  due: number;
  streak: number;
}

const STATUS_META: Record<Progress["status"], { label: string; variant: "success" | "warning" | "muted" }> = {
  new: { label: "新词", variant: "muted" },
  learning: { label: "学习中", variant: "warning" },
  mastered: { label: "已掌握", variant: "success" },
};

// 浏览器内置发音（Web Speech API）
function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function VocabularyManager() {
  const { data: books, mutate: mutateBooks } = useSWR<Book[]>("/api/vocabulary/books", fetcher);
  const { data: stats, mutate: mutateStats } = useSWR<Stats>("/api/vocabulary/stats", fetcher);

  const [activeBookId, setActiveBookId] = useState<string>("");
  const activeBook = books?.find((b) => b.id === activeBookId);

  const { data: words, mutate: mutateWords } = useSWR<WordItem[]>(
    activeBookId ? `/api/vocabulary/books/${activeBookId}/words` : null,
    fetcher,
  );

  useEffect(() => {
    if (!activeBookId && books?.length) setActiveBookId(books[0].id);
  }, [books, activeBookId]);

  const [view, setView] = useState<"cards" | "quiz" | "list">("cards");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 新建 / 导入 / 删除词库
  const [newBookOpen, setNewBookOpen] = useState(false);
  const [newBookName, setNewBookName] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFormat, setImportFormat] = useState<"auto" | "json" | "csv" | "txt">("auto");
  const [importText, setImportText] = useState("");
  const [importTarget, setImportTarget] = useState<"new" | "current">("new");
  const [importBookName, setImportBookName] = useState("");

  async function createBook() {
    const name = newBookName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const b = await api<Book>("/api/vocabulary/books", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      mutateBooks();
      setNewBookName("");
      setNewBookOpen(false);
      setActiveBookId(b.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  async function deleteBook() {
    if (!activeBook || activeBook.isBuiltin) return;
    if (!confirm(`确定删除词库「${activeBook.name}」？其中的单词将一并删除。`)) return;
    setBusy(true);
    try {
      await api(`/api/vocabulary/books/${activeBook.id}`, { method: "DELETE" });
      mutateBooks();
      setActiveBookId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    const text = importText.trim();
    if (!text) return;
    setBusy(true);
    try {
      const res = await api<{ inserted: number; skipped: number }>("/api/vocabulary/import", {
        method: "POST",
        body: JSON.stringify({
          format: importFormat,
          content: text,
          bookId: importTarget === "current" ? activeBookId : "",
          name: importBookName.trim() || undefined,
        }),
      });
      mutateBooks();
      mutateStats();
      if (importTarget === "current") mutateWords();
      setImportOpen(false);
      setImportText("");
      alert(`导入完成：新增 ${res.inserted} 个，跳过 ${res.skipped} 个已存在。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setBusy(false);
    }
  }

  // 背单词会话队列：待复习（到期）+ 新词，最多 20 个
  const session = useMemo<WordItem[]>(() => {
    if (!words) return [];
    const now = Date.now();
    const due = words.filter((w) => w.progress && w.progress.nextReviewAt && new Date(w.progress.nextReviewAt).getTime() <= now);
    const fresh = words.filter((w) => !w.progress || !w.progress.nextReviewAt);
    return [...due, ...fresh].slice(0, 20);
  }, [words]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">背单词</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          内置高频词库 + 自定义导入，FSRS 间隔重复排期，发音使用浏览器内置语音。
        </p>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "单词总数", value: stats?.total ?? 0, icon: BookMarked, cls: "" },
          { label: "已掌握", value: stats?.mastered ?? 0, icon: Brain, cls: "text-emerald-600" },
          { label: "学习中", value: stats?.learning ?? 0, icon: Layers, cls: "text-amber-600" },
          { label: "待复习", value: stats?.due ?? 0, icon: BookMarked, cls: "text-blue-600" },
          { label: "连续打卡", value: `${stats?.streak ?? 0} 天`, icon: Flame, cls: "text-orange-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <s.icon className={`h-5 w-5 ${s.cls}`} />
              <div>
                <div className="text-xl font-bold leading-none">{s.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* 词库选择 + 操作 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">词库</CardTitle>
          <CardDescription>选择词库开始背单词；自定义词库可删除，内置词库共享。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {books?.map((b) => (
              <button
                key={b.id}
                onClick={() => setActiveBookId(b.id)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  b.id === activeBookId ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
                }`}
              >
                {b.name}
                <span className="ml-1.5 text-xs text-muted-foreground">{b.wordCount}</span>
                {b.isBuiltin && <Badge variant="muted" className="ml-1.5 px-1.5 py-0 text-[10px]">内置</Badge>}
              </button>
            ))}
            <Button variant="outline" size="sm" onClick={() => setNewBookOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> 新建词库
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Import className="mr-1 h-4 w-4" /> 导入词表
            </Button>
            {activeBook && !activeBook.isBuiltin && (
              <Button variant="ghost" size="sm" onClick={deleteBook} disabled={busy}>
                <Trash2 className="mr-1 h-4 w-4 text-destructive" /> 删除
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 模式切换 */}
      <div className="flex gap-2">
        {(
          [
            { key: "cards", label: "背单词" },
            { key: "quiz", label: "测验" },
            { key: "list", label: "单词表" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              view === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === "cards" && (
        <Flashcards
          bookId={activeBookId}
          session={session}
          onReviewed={() => mutateStats()}
          onRestart={() => mutateWords()}
        />
      )}
      {view === "quiz" && <Quiz words={words ?? []} />}
      {view === "list" && <WordList words={words ?? []} />}

      {/* 新建词库 */}
      <Dialog open={newBookOpen} onOpenChange={setNewBookOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建词库</DialogTitle>
            <DialogDescription>创建一个空的自定义词库，随后可导入词表。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="book-name">词库名称</Label>
            <Input
              id="book-name"
              value={newBookName}
              onChange={(e) => setNewBookName(e.target.value)}
              placeholder="例如：雅思核心词汇"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewBookOpen(false)}>取消</Button>
            <Button onClick={createBook} disabled={busy || !newBookName.trim()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导入词表 */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>导入词表</DialogTitle>
            <DialogDescription>
              支持 JSON 数组、CSV 行（word,meaning）或 TXT 行（word 释义）。已存在的单词自动跳过。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(["auto", "json", "csv", "txt"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setImportFormat(f)}
                  className={`rounded-md border px-3 py-1 text-sm ${importFormat === f ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}
                >
                  {f === "auto" ? "自动识别" : f.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["new", "current"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setImportTarget(t)}
                  className={`rounded-md border px-3 py-1 text-sm ${importTarget === t ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}
                >
                  {t === "new" ? "新建词库" : activeBook ? `导入到「${activeBook.name}」` : "导入到当前词库"}
                </button>
              ))}
            </div>
            {importTarget === "new" && (
              <div className="space-y-1">
                <Label htmlFor="import-name">新词库名称（可选）</Label>
                <Input
                  id="import-name"
                  value={importBookName}
                  onChange={(e) => setImportBookName(e.target.value)}
                  placeholder="默认「导入词库」"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="import-text">内容</Label>
              <Textarea
                id="import-text"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={8}
                placeholder={'apple,苹果\nbook,书\n或：\nabandon 放弃'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>取消</Button>
            <Button onClick={doImport} disabled={busy || !importText.trim()}>导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- 背单词卡片流 ----
function Flashcards({
  bookId,
  session,
  onReviewed,
  onRestart,
}: {
  bookId: string;
  session: WordItem[];
  onReviewed: () => void;
  onRestart: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  // 切换词库时重置进度
  useEffect(() => {
    setIdx(0);
    setFlipped(false);
    setDone(0);
  }, [bookId]);

  const word = session[idx];

  async function grade(quality: number) {
    if (!word) return;
    setBusy(true);
    try {
      await api("/api/vocabulary/review", {
        method: "POST",
        body: JSON.stringify({ wordId: word.id, quality }),
      });
      setDone((d) => d + 1);
      setFlipped(false);
      if (idx + 1 >= session.length) {
        onReviewed();
        setIdx(session.length); // 结束
      } else {
        setIdx(idx + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  if (session.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          🎉 该词库暂无可背单词。新词背完后，请按遗忘曲线等待到期复习，或导入更多单词。
        </CardContent>
      </Card>
    );
  }

  if (idx >= session.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-lg font-medium">本轮完成 🎉</p>
          <p className="mt-1 text-sm text-muted-foreground">本轮复习了 {done} 个单词，继续加油。</p>
          <Button
            className="mt-4"
            onClick={() => {
              onRestart();
              setIdx(0);
              setFlipped(false);
              setDone(0);
            }}
          >
            再背一轮
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="space-y-6 py-8">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>第 {idx + 1} / {session.length} 个</span>
          <span>本轮已复习 {done}</span>
        </div>

        <div
          onClick={() => setFlipped(true)}
          className="cursor-pointer select-none rounded-xl border bg-background py-16 text-center transition-colors hover:bg-accent/40"
        >
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl font-bold">{word.word}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                speak(word.word);
              }}
              className="rounded-full border p-2 text-muted-foreground transition-colors hover:text-foreground"
              title="发音"
            >
              <Volume2 className="h-5 w-5" />
            </button>
          </div>
          {word.phonetic && <div className="mt-2 text-sm text-muted-foreground">{word.phonetic}</div>}

          {flipped ? (
            <div className="mt-6 space-y-3 px-6">
              <p className="text-lg font-medium text-foreground">{word.meaning}</p>
              {word.example && (
                <p className="text-sm text-muted-foreground">
                  {word.example}
                  {word.exampleMeaning && <span className="mt-1 block">{word.exampleMeaning}</span>}
                </p>
              )}
              {word.progress && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                  <Badge variant={STATUS_META[word.progress.status].variant}>
                    {STATUS_META[word.progress.status].label}
                  </Badge>
                  <Badge variant="outline">间隔 {formatInterval(word.progress.intervalDays)}</Badge>
                  <Badge variant="muted">错 {word.progress.wrongCount} 次</Badge>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-8 text-sm text-muted-foreground">点击卡片查看释义</p>
          )}
        </div>

        {flipped ? (
          <div className="grid grid-cols-4 gap-2">
            {REVIEW_GRADES.map((g) => (
              <button
                key={g.value}
                onClick={() => grade(g.value)}
                disabled={busy}
                className="rounded-md border py-3 text-sm transition-colors hover:bg-accent disabled:opacity-50"
              >
                <span className="block text-lg">{g.emoji}</span>
                <span className="text-xs">{g.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <Button className="w-full" onClick={() => setFlipped(true)}>
            显示答案
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ---- 测验（四选一 / 拼写）----
function Quiz({ words }: { words: WordItem[] }) {
  const [mode, setMode] = useState<"choice" | "spell">("choice");
  const [queue, setQueue] = useState<WordItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const q = shuffle(words).slice(0, 10);
    setQueue(q);
    setIdx(0);
    setSelected(null);
    setInput("");
    setChecked(false);
    setScore(0);
  }, [words, mode]);

  const word = queue[idx];
  const options = useMemo(() => {
    if (!word || mode !== "choice") return [];
    const others = shuffle(words.filter((w) => w.id !== word.id))
      .slice(0, 3)
      .map((w) => w.meaning);
    return shuffle([word.meaning, ...others]);
  }, [word, words, mode]);

  if (words.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          该词库暂无单词，无法测验。
        </CardContent>
      </Card>
    );
  }

  if (!word) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-lg font-medium">测验完成 🎉</p>
          <p className="mt-1 text-sm text-muted-foreground">
            得分 {score} / {queue.length}
          </p>
        </CardContent>
      </Card>
    );
  }

  const isCorrect = mode === "choice" ? selected === word.meaning : input.trim().toLowerCase() === word.word.toLowerCase();

  function next() {
    if (isCorrect) setScore((s) => s + 1);
    setSelected(null);
    setInput("");
    setChecked(false);
    setIdx(idx + 1);
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="space-y-6 py-8">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            第 {idx + 1} / {queue.length} 个 · 得分 {score}
          </span>
          <div className="flex gap-2">
            {(["choice", "spell"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 text-xs ${mode === m ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
              >
                {m === "choice" ? "四选一" : "拼写"}
              </button>
            ))}
          </div>
        </div>

        {mode === "choice" ? (
          <div className="space-y-3">
            <div className="text-center">
              <button onClick={() => speak(word.word)} className="mb-2 rounded-full border p-2 text-muted-foreground hover:text-foreground" title="发音">
                <Volume2 className="h-5 w-5" />
              </button>
              <p className="text-3xl font-bold">{word.word}</p>
              <p className="mt-1 text-sm text-muted-foreground">选择正确释义</p>
            </div>
            {options.map((opt) => {
              const chosen = selected === opt;
              const reveal = checked && opt === word.meaning;
              return (
                <button
                  key={opt}
                  onClick={() => {
                    if (checked) return;
                    setSelected(opt);
                    setChecked(true);
                  }}
                  className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                    reveal ? "border-emerald-500 bg-emerald-50" : chosen ? "border-destructive bg-destructive/10" : "hover:bg-accent"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-lg font-medium text-muted-foreground">请拼写下列释义对应的单词</p>
              <p className="mt-2 text-xl font-bold">{word.meaning}</p>
            </div>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !checked && setChecked(true)}
              placeholder="输入单词…"
            />
            {checked && (
              <p className={`text-sm ${isCorrect ? "text-emerald-600" : "text-destructive"}`}>
                {isCorrect ? "✅ 正确" : `❌ 正确答案：${word.word}`}
              </p>
            )}
            {!checked && (
              <Button className="w-full" onClick={() => setChecked(true)} disabled={!input.trim()}>
                检查
              </Button>
            )}
          </div>
        )}

        {checked && (
          <Button className="w-full" onClick={next}>
            下一题
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ---- 单词表 ----
function WordList({ words }: { words: WordItem[] }) {
  if (words.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          该词库暂无单词。
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {words.map((w) => (
            <li key={w.id} className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => speak(w.word)} className="shrink-0 text-muted-foreground hover:text-foreground" title="发音">
                <Volume2 className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <span className="font-medium">{w.word}</span>
                {w.phonetic && <span className="ml-2 text-xs text-muted-foreground">{w.phonetic}</span>}
                <p className="text-sm text-muted-foreground">{w.meaning}</p>
              </div>
              {w.progress ? (
                <Badge variant={STATUS_META[w.progress.status].variant}>
                  {STATUS_META[w.progress.status].label}
                </Badge>
              ) : (
                <Badge variant="muted">新词</Badge>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
