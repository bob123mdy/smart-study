"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/api";
import { MODE_LABELS, MODES, type ChapterContext, type Mode } from "@/lib/ai/prompts";
import { TEACHER_TYPE_META } from "@/lib/teachers";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Markdown } from "./markdown";
import { BookmarkPlus, MessageSquare, Plus, Send, Square, Trash2 } from "lucide-react";

interface TeacherInfo {
  id: string;
  name: string;
  type: string;
  subject: string | null;
  modelTier: string;
}
interface Conv {
  id: string;
  title: string | null;
  mode: string;
  teacherPersonaId: string | null;
  teacherName: string | null;
}
interface Msg {
  id: string;
  role: string;
  content: string;
}
interface SubjectTree {
  id: string;
  name: string;
  chapters: { id: string; name: string; knowledgePoints: { id: string; name: string }[] }[];
}

export function ChatRoom({
  teacher,
  initialKpId = "",
  initialMode = "explain",
  initialChapter = null,
}: {
  teacher: TeacherInfo;
  initialKpId?: string;
  initialMode?: Mode;
  initialChapter?: (ChapterContext & { id: string }) | null;
}) {
  const { data: convs, mutate: mutateConvs } = useSWR<Conv[]>("/api/conversations", fetcher);
  const { data: subjectTree } = useSWR<SubjectTree[]>("/api/subjects", fetcher);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [kpId, setKpId] = useState(initialKpId);
  const [chapterId, setChapterId] = useState(initialChapter?.id ?? "");
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const meta = TEACHER_TYPE_META[teacher.type] ?? { label: teacher.type, emoji: "🧑‍🏫" };
  const myConvs = (convs ?? []).filter((c) => c.teacherPersonaId === teacher.id);

  const kpOptions = (subjectTree ?? []).flatMap((s) =>
    s.chapters.flatMap((c) =>
      c.knowledgePoints.map((k) => ({ id: k.id, label: `${s.name}·${c.name}·${k.name}` })),
    ),
  );

  // 由当前知识点反查所属科目，供「记入错题本」自动关联
  const kpSubjectId = useMemo(() => {
    if (!kpId || !subjectTree) return null;
    for (const s of subjectTree) {
      for (const c of s.chapters) {
        if (c.knowledgePoints.some((k) => k.id === kpId)) return s.id;
      }
    }
    return null;
  }, [kpId, subjectTree]);

  const [wrong, setWrong] = useState({ open: false, question: "", answer: "", reason: "" });
  const [savingWrong, setSavingWrong] = useState(false);

  async function submitWrong() {
    if (!wrong.question.trim()) return;
    setSavingWrong(true);
    try {
      await api("/api/wrong-questions", {
        method: "POST",
        body: JSON.stringify({
          question: wrong.question.trim(),
          answer: wrong.answer.trim() || null,
          errorReason: wrong.reason.trim() || null,
          source: "tutoring",
          knowledgePointId: kpId || null,
          subjectId: kpSubjectId,
        }),
      });
      setWrong({ open: false, question: "", answer: "", reason: "" });
    } finally {
      setSavingWrong(false);
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth", block: "end" });
  }, [messages, streaming]);

  // 章节带学：进入即让老师自动开讲（规划→学习→考察→查缺补漏），无需用户手动发首条消息
  const kickedRef = useRef(false);
  useEffect(() => {
    if (!initialChapter || kickedRef.current) return;
    kickedRef.current = true;
    send(
      `请带我完整学习本章「${initialChapter.name}」：先规划学习路径，再逐个知识点讲解，讲完出题考察，最后针对薄弱点查缺补漏并总结。`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChapter]);

  async function openConv(id: string) {
    setConvId(id);
    setLoadingConv(true);
    try {
      const data = await api<{ messages: Msg[]; mode: string }>(`/api/conversations/${id}`);
      setMessages(data.messages ?? []);
      if (data.mode) setMode(data.mode as Mode);
    } catch (e) {
      setMessages([]);
    } finally {
      setLoadingConv(false);
    }
  }

  function newConv() {
    setConvId(null);
    setMessages([]);
    setInput("");
  }

  async function delConv(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("删除该对话？")) return;
    await api(`/api/conversations/${id}`, { method: "DELETE" });
    if (convId === id) newConv();
    mutateConvs();
  }

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || streaming) return;
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "user", content: text }]);
    setInput("");
    setStreaming(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          teacherPersonaId: teacher.id,
          mode,
          message: text,
          conversationId: convId ?? undefined,
          knowledgePointId: kpId || undefined,
          chapterId: chapterId || undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        const err = (data as { error?: string } | null)?.error ?? "请求失败，请稍后重试";
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: "assistant", content: `⚠️ ${err}` },
        ]);
        return;
      }

      const asstId = `local-asst-${Date.now()}`;
      setStreamingId(asstId);
      setMessages((prev) => [...prev, { id: asstId, role: "assistant", content: "" }]);

      let full = "";
      let raf = 0;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          let obj: { type: string; conversationId?: string; content?: string; messageId?: string; error?: string };
          try {
            obj = JSON.parse(t.slice(5).trim());
          } catch {
            continue;
          }
          if (obj.type === "meta") {
            if (obj.conversationId) setConvId(obj.conversationId);
          } else if (obj.type === "delta") {
            full += obj.content ?? "";
            if (raf) continue;
            raf = requestAnimationFrame(() => {
              raf = 0;
              const snapshot = full;
              setMessages((prev) =>
                prev.map((m) => (m.id === asstId ? { ...m, content: snapshot } : m)),
              );
            });
          } else if (obj.type === "done") {
            const final = obj.content ?? "";
            if (raf) {
              cancelAnimationFrame(raf);
              raf = 0;
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstId
                  ? { ...m, id: obj.messageId ?? asstId, content: final || full || m.content }
                  : m,
              ),
            );
          } else if (obj.type === "error") {
            const err = obj.error ?? "生成中断";
            if (raf) {
              cancelAnimationFrame(raf);
              raf = 0;
            }
            const base = full || "";
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstId
                  ? { ...m, content: base ? `${base}\n\n⚠️ ${err}` : `⚠️ ${err}` }
                  : m,
              ),
            );
          }
        }
      }
    } catch (e) {
      if (!abort.signal.aborted) {
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: "assistant", content: "⚠️ 网络异常，生成中断" },
        ]);
      }
    } finally {
      setStreaming(false);
      setStreamingId(null);
      abortRef.current = null;
      mutateConvs();
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  return (
    <>
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* 会话侧边栏 */}
      <aside className="lg:border-r lg:pr-4">
        <Button variant="outline" size="sm" className="w-full" onClick={newConv}>
          <Plus className="h-4 w-4" /> 新对话
        </Button>
        <div className="mt-3 space-y-1">
          {myConvs.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent",
                convId === c.id && "bg-accent",
              )}
            >
              <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => openConv(c.id)}>
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{c.title ?? "新对话"}</span>
              </button>
              <button
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                onClick={(e) => delConv(c.id, e)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {myConvs.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">还没有和这位老师的对话</p>
          )}
        </div>
      </aside>

      {/* 聊天区 */}
      <section className="flex min-w-0 flex-col">
        <div className="mb-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl">{meta.emoji}</span>
            <h1 className="text-lg font-bold">{teacher.name}</h1>
            <Badge variant="secondary">全能学习伙伴</Badge>
            <span className="text-xs text-muted-foreground">
              {teacher.modelTier === "reasoner" ? "深度推理模型" : "常规模型"}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <Button
                key={m}
                size="sm"
                variant={mode === m ? "default" : "outline"}
                onClick={() => setMode(m)}
              >
                {MODE_LABELS[m]}
              </Button>
            ))}
          </div>

          {kpOptions.length > 0 && (
            <select
              value={kpId}
              onChange={(e) => setKpId(e.target.value)}
              className="flex h-9 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">不绑定知识点（自由问答）</option>
              {kpOptions.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="max-h-[52vh] space-y-4 overflow-y-auto rounded-lg border p-4 lg:max-h-[calc(100vh-320px)]">
          {loadingConv && <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>}
          {!loadingConv && messages.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              和 {teacher.name} 打个招呼，开始学习吧
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex items-center gap-1.5",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {m.role === "user" && (
                <button
                  onClick={() => setWrong({ open: true, question: m.content, answer: "", reason: "" })}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="记入错题本"
                >
                  <BookmarkPlus className="h-4 w-4" />
                </button>
              )}
              <div
                className={cn(
                  "max-w-[88%] rounded-lg px-4 py-2.5 text-sm",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {m.role === "assistant" ? (
                  m.id === streamingId ? (
                    m.content ? (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    ) : (
                      <span className="inline-block animate-pulse text-muted-foreground">正在思考…</span>
                    )
                  ) : (
                    <Markdown text={m.content} />
                  )
                ) : (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                )}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        <div className="mt-3 flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={streaming ? "生成中…" : "输入问题，Enter 发送，Shift+Enter 换行"}
            className="min-h-[48px] flex-1"
          />
          {streaming ? (
            <Button variant="destructive" size="icon" onClick={stopStreaming} title="停止生成">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="icon" onClick={() => send()} disabled={!input.trim()} title="发送">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </section>
    </div>

    <Dialog open={wrong.open} onOpenChange={(o) => setWrong((s) => ({ ...s, open: o }))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>记入错题本</DialogTitle>
          <DialogDescription>答错的题目会自动关联当前知识点，便于针对性复习</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>题目</Label>
            <Textarea
              value={wrong.question}
              onChange={(e) => setWrong((s) => ({ ...s, question: e.target.value }))}
              placeholder="题目内容"
            />
          </div>
          <div className="space-y-2">
            <Label>我的答案（可选）</Label>
            <Input
              value={wrong.answer}
              onChange={(e) => setWrong((s) => ({ ...s, answer: e.target.value }))}
              placeholder="当时怎么答的"
            />
          </div>
          <div className="space-y-2">
            <Label>错因（可选）</Label>
            <Input
              value={wrong.reason}
              onChange={(e) => setWrong((s) => ({ ...s, reason: e.target.value }))}
              placeholder="概念不清 / 计算错误 / 粗心…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setWrong((s) => ({ ...s, open: false }))}>
            取消
          </Button>
          <Button onClick={submitWrong} disabled={savingWrong || !wrong.question.trim()}>
            {savingWrong ? "保存中…" : "记入"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
