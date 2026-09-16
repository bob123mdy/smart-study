"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/api";
import { ERROR_TYPES, ERROR_TYPE_EMOJI, WQ_SOURCES, WQ_STATUSES } from "@/lib/wrong-questions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";

interface KnowledgePoint {
  id: string;
  name: string;
}
interface Subject {
  id: string;
  name: string;
  chapters: { id: string; name: string; knowledgePoints: KnowledgePoint[] }[];
}
interface WrongQuestion {
  id: string;
  subjectId: string | null;
  knowledgePointId: string | null;
  subjectName: string | null;
  knowledgePointName: string | null;
  question: string;
  answer: string | null;
  errorReason: string | null;
  errorType: string;
  source: string;
  tags: string[];
  status: string;
  reviewCount: number;
  createdAt: string;
}

const NEXT_STATUS: Record<string, string> = { unreviewed: "reviewing", reviewing: "mastered", mastered: "unreviewed" };
const NEXT_STATUS_LABEL: Record<string, string> = {
  unreviewed: "标记复习中",
  reviewing: "标记已掌握",
  mastered: "重置为未复习",
};

const sourceLabel = (v: string) => WQ_SOURCES.find((s) => s.value === v)?.label ?? v;

export function WrongQuestionManager() {
  const { data: subjects } = useSWR<Subject[]>("/api/subjects", fetcher);
  const { data: questions, mutate } = useSWR<WrongQuestion[]>("/api/wrong-questions", fetcher);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [errorReason, setErrorReason] = useState("");
  const [errorType, setErrorType] = useState("concept");
  const [subjectId, setSubjectId] = useState("");
  const [knowledgePointId, setKnowledgePointId] = useState("");
  const [source, setSource] = useState("manual");
  const [tagsInput, setTagsInput] = useState("");
  const [busy, setBusy] = useState(false);

  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const kpOptions = useMemo(() => {
    if (!subjectId) return [];
    const sub = (subjects ?? []).find((s) => s.id === subjectId);
    return sub ? sub.chapters.flatMap((c) => c.knowledgePoints) : [];
  }, [subjects, subjectId]);

  const filtered = (questions ?? []).filter(
    (q) =>
      (filterType === "all" || q.errorType === filterType) &&
      (filterStatus === "all" || q.status === filterStatus),
  );

  async function add() {
    if (!question.trim()) return;
    setBusy(true);
    try {
      await api("/api/wrong-questions", {
        method: "POST",
        body: JSON.stringify({
          question: question.trim(),
          answer: answer.trim() || null,
          errorReason: errorReason.trim() || null,
          errorType,
          subjectId: subjectId || null,
          knowledgePointId: knowledgePointId || null,
          source,
          tags: tagsInput.split(/[,，\s]+/).filter(Boolean),
        }),
      });
      setQuestion("");
      setAnswer("");
      setErrorReason("");
      setTagsInput("");
      mutate();
    } finally {
      setBusy(false);
    }
  }

  async function cycleStatus(q: WrongQuestion) {
    await api(`/api/wrong-questions/${q.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: NEXT_STATUS[q.status] }),
    });
    mutate();
  }

  async function del(id: string) {
    if (!confirm("删除这道错题？")) return;
    await api(`/api/wrong-questions/${id}`, { method: "DELETE" });
    mutate();
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const statTotal = (questions ?? []).length;
  const statUnreviewed = (questions ?? []).filter((q) => q.status === "unreviewed").length;
  const statMastered = (questions ?? []).filter((q) => q.status === "mastered").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">错题本</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          记录做错的题，关联知识点与错因，反复复习直到掌握。已积累 {statTotal} 题（未复习 {statUnreviewed} · 已掌握 {statMastered}）。
        </p>
      </div>

      {/* 新增 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">记录一道错题</CardTitle>
          <CardDescription>题干必填，其余可选。错因分类用于日后针对性复习。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="题干（必填）…"
          />
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="正确答案 / 解析（可选）…"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={errorType}
              onChange={(e) => setErrorType(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ERROR_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.emoji} {t.label}
                </option>
              ))}
            </select>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {WQ_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setKnowledgePointId("");
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">关联科目（可选）</option>
              {(subjects ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={knowledgePointId}
              onChange={(e) => setKnowledgePointId(e.target.value)}
              disabled={!subjectId}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">关联知识点（可选）</option>
              {kpOptions.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Input
              value={errorReason}
              onChange={(e) => setErrorReason(e.target.value)}
              placeholder="错因描述，如「行列式展开时漏了负号」（可选）"
            />
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="标签，用逗号分隔，如「特征值,计算」（可选）"
            />
          </div>
          <Button onClick={add} disabled={busy || !question.trim()}>
            <Plus className="h-4 w-4" /> 保存错题
          </Button>
        </CardContent>
      </Card>

      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">全部错因</option>
          {ERROR_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.emoji} {t.label}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">全部状态</option>
          {WQ_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* 列表 */}
      {!questions ? (
        <p className="py-10 text-center text-sm text-muted-foreground">加载中…</p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {questions.length === 0 ? "还没有错题，从上面记录第一道吧" : "当前筛选下没有错题"}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => {
            const isOpen = expanded.has(q.id);
            return (
              <Card key={q.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0">{ERROR_TYPE_EMOJI[q.errorType] ?? "❓"}</span>
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => toggleExpand(q.id)}
                        className="block w-full text-left text-sm font-medium hover:underline"
                      >
                        {q.question}
                      </button>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant="muted">{sourceLabel(q.source)}</Badge>
                        {q.subjectName && <Badge variant="secondary">{q.subjectName}</Badge>}
                        {q.knowledgePointName && <Badge variant="outline">{q.knowledgePointName}</Badge>}
                        {q.tags.map((t) => (
                          <Badge key={t} variant="outline">
                            #{t}
                          </Badge>
                        ))}
                        <span className="text-xs text-muted-foreground">复习 {q.reviewCount} 次</span>
                      </div>

                      {isOpen && (
                        <div className="mt-3 space-y-2 rounded-md border border-dashed p-3 text-sm">
                          {q.answer && (
                            <div>
                              <div className="font-medium text-foreground">答案 / 解析</div>
                              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{q.answer}</p>
                            </div>
                          )}
                          {q.errorReason && (
                            <div>
                              <div className="font-medium text-foreground">错因</div>
                              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{q.errorReason}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge
                        variant={q.status === "mastered" ? "success" : q.status === "reviewing" ? "secondary" : "default"}
                      >
                        {WQ_STATUSES.find((s) => s.value === q.status)?.label}
                      </Badge>
                      <button
                        onClick={() => cycleStatus(q)}
                        className="rounded p-1.5 text-muted-foreground hover:text-foreground"
                        title={NEXT_STATUS_LABEL[q.status]}
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => del(q.id)}
                        className="rounded p-1.5 text-muted-foreground hover:text-destructive"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
