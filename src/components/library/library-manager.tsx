"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/chat/markdown";
import { FileUp, Loader2, Search, Trash2 } from "lucide-react";

interface Document {
  id: string;
  title: string;
  fileType: string;
  status: string;
  chunkCount: number;
  errorMsg: string | null;
  createdAt: string;
}
interface RagResult {
  answer: string;
  sources: { title: string; content: string; similarity: number }[];
  matched: boolean;
}

const TYPE_LABELS: Record<string, string> = { txt: "文本", md: "Markdown", pdf: "PDF", docx: "Word" };

const STATUS_META: Record<string, { label: string; variant: "success" | "secondary" | "destructive" | "muted" }> = {
  indexing: { label: "处理中", variant: "secondary" },
  ready: { label: "已索引", variant: "success" },
  ready_no_embedding: { label: "已索引·关键词", variant: "secondary" },
  error: { label: "失败", variant: "destructive" },
};

export function LibraryManager() {
  const { data: docs, mutate } = useSWR<Document[]>("/api/documents", fetcher);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<RagResult | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "上传失败");
      mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function del(id: string) {
    if (!confirm("删除该文档及其切块？")) return;
    await api(`/api/documents/${id}`, { method: "DELETE" });
    mutate();
  }

  async function ask() {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setResult(null);
    try {
      const data = await api<RagResult>("/api/rag/query", {
        method: "POST",
        body: JSON.stringify({ question: q }),
      });
      setResult(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "查询失败");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">资料库</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          上传 PDF / Word / Markdown / 文本，基于资料问答并引用来源；资料中找不到的会明确告知，绝不编造。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 上传 + 文档列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">文档</CardTitle>
            <CardDescription>上传后自动提取文本并切分（配置 embedding key 时还会向量化）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.pdf,.docx"
                onChange={onFile}
                className="hidden"
              />
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full"
                variant="outline"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                {uploading ? "解析中…" : "上传文档"}
              </Button>
            </div>

            {!docs ? (
              <p className="py-6 text-center text-sm text-muted-foreground">加载中…</p>
            ) : docs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">还没有文档，上传一份试试</p>
            ) : (
              <ul className="divide-y">
                {docs.map((d) => {
                  const st = STATUS_META[d.status] ?? { label: d.status, variant: "muted" as const };
                  return (
                    <li key={d.id} className="flex items-center gap-2 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{d.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {TYPE_LABELS[d.fileType] ?? d.fileType} · {d.chunkCount} 块
                          {d.errorMsg ? ` · ${d.errorMsg}` : ""}
                        </p>
                      </div>
                      <Badge variant={st.variant}>{st.label}</Badge>
                      <button
                        onClick={() => del(d.id)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 问答 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基于资料问答</CardTitle>
            <CardDescription>检索你的资料库并引用来源；找不到则明确说明</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") ask();
                }}
                placeholder="向资料库提问，例如「什么是矩阵的秩」"
              />
              <Button onClick={ask} disabled={asking || !question.trim()}>
                <Search className="h-4 w-4" /> 提问
              </Button>
            </div>

            {result && (
              <div className="space-y-3">
                <div className="rounded-md border p-3">
                  <Markdown text={result.answer} />
                </div>
                {result.sources.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">引用来源</p>
                    {result.sources.map((s, i) => (
                      <div key={i} className="rounded-md border p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium">{s.title}</span>
                          <Badge variant="muted">相关度 {Math.round(s.similarity * 100)}%</Badge>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                          {expanded === i
                            ? s.content
                            : s.content.slice(0, 120) + (s.content.length > 120 ? "…" : "")}
                        </p>
                        {s.content.length > 120 && (
                          <button
                            className="text-xs text-primary hover:underline"
                            onClick={() => setExpanded(expanded === i ? null : i)}
                          >
                            {expanded === i ? "收起" : "展开"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
