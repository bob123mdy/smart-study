"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, RefreshCw, X } from "lucide-react";

type Mcq = { type: "mcq"; question: string; options: string[]; answer: number; explanation: string };
type Recall = { type: "recall"; title: string; answer: string; explanation: string };
type Question = Mcq | Recall;

interface Result {
  kpName: string;
  chapter: string | null;
  subject: string | null;
  question: Question;
  source: "ai" | "local";
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function McqCard({ question, onNext }: { question: Mcq; onNext: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;
  const correct = selected === question.answer;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">单选题</CardTitle>
        <CardDescription>{question.question}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {question.options.map((opt, i) => {
          const isSelected = selected === i;
          const isAnswer = i === question.answer;
          const showCorrect = answered && isAnswer;
          const showWrong = isSelected && !isAnswer;
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => setSelected(i)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                !answered && "hover:bg-accent",
                showCorrect && "border-emerald-400 bg-emerald-50 text-emerald-800",
                showWrong && "border-red-400 bg-red-50 text-red-800",
                answered && !showCorrect && !showWrong && "opacity-60",
              )}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold">
                {LETTERS[i]}
              </span>
              <span className="flex-1">{opt}</span>
              {showCorrect && <Check className="h-4 w-4 shrink-0" />}
              {showWrong && <X className="h-4 w-4 shrink-0" />}
            </button>
          );
        })}
        {answered && (
          <>
            <div className="rounded-md bg-muted/60 p-3 text-sm">
              <p className="font-medium">
                {correct ? "✅ 回答正确" : `❌ 回答错误，正确答案是 ${LETTERS[question.answer]}`}
              </p>
              {question.explanation && <p className="mt-1 text-muted-foreground">{question.explanation}</p>}
            </div>
            <Button onClick={onNext} className="w-full">
              <RefreshCw className="h-4 w-4" /> 再来一题
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RecallCard({ question, onNext }: { question: Recall; onNext: () => void }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">自测复述</CardTitle>
        <CardDescription>先凭记忆复述「{question.title}」的要点，再翻答案对照</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!revealed ? (
          <Button onClick={() => setRevealed(true)} className="w-full">
            翻看答案
          </Button>
        ) : (
          <>
            <p className="whitespace-pre-wrap rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
              {question.answer}
            </p>
            <Button onClick={onNext} className="w-full">
              <RefreshCw className="h-4 w-4" /> 下一题
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function PracticeSession({ kpId, kpName }: { kpId: string; kpName: string }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [qid, setQid] = useState(0);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      setResult(await api<Result>(`/api/knowledge-points/${kpId}/practice`, { method: "POST" }));
      setQid((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "出题失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api<Result>(`/api/knowledge-points/${kpId}/practice`, { method: "POST" });
        if (!cancelled) {
          setResult(r);
          setQid((n) => n + 1);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "出题失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kpId]);

  const q = result?.question;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">知识点练习</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          围绕「{result?.kpName ?? kpName}」自动出题，选对自动判分
          {result?.source === "local" && " · 未配置 AI，进入自测模式"}
        </p>
      </div>

      {error && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">正在出题…</CardContent>
        </Card>
      ) : q?.type === "mcq" ? (
        <McqCard key={qid} question={q} onNext={generate} />
      ) : q?.type === "recall" ? (
        <RecallCard key={qid} question={q} onNext={generate} />
      ) : null}
    </div>
  );
}
