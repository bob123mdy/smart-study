"use client";

import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { MODES, MODE_META } from "@/lib/ai/prompts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

interface Teacher {
  id: string;
  name: string;
  type: string;
  subject: string | null;
  systemPrompt: string | null;
  modelTier: string;
}

export default function TeachersPage() {
  const { data: teachers } = useSWR<Teacher[]>("/api/teachers", fetcher);
  const teacher = (teachers ?? [])[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">我的老师</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          你只有一位全能学习伙伴——林老师，她拥有多种能力，可在同一段对话中随时切换。
        </p>
      </div>

      {teacher && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-4xl">🧑‍🏫</span>
                <div>
                  <CardTitle className="text-lg">{teacher.name}</CardTitle>
                  <CardDescription>{teacher.subject ?? "全科"} · 全能学习伙伴</CardDescription>
                </div>
              </div>
              <Badge variant="secondary">
                {teacher.modelTier === "reasoner" ? "深度推理模型" : "常规模型"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="whitespace-pre-line text-sm text-muted-foreground">{teacher.systemPrompt}</p>
            <Button asChild>
              <Link href={`/teachers/${teacher.id}`}>
                <MessageSquare className="h-4 w-4" /> 开始对话
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">能力清单</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m) => {
            const meta = MODE_META[m];
            return (
              <Card key={m}>
                <CardContent className="flex flex-col items-center gap-2 py-5 text-center">
                  <span className="text-3xl">{meta.emoji}</span>
                  <p className="text-sm font-medium">{meta.label}</p>
                  <p className="text-xs text-muted-foreground">{meta.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {!teachers && (
        <p className="py-10 text-center text-sm text-muted-foreground">加载中…</p>
      )}
    </div>
  );
}
