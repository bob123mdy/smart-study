"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { api, fetcher } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Square, Trash2 } from "lucide-react";

interface Session {
  id: string;
  subjectId: string | null;
  subjectName: string | null;
  startedAt: string;
  durationMinutes: number;
  note: string | null;
}
interface SubjectOption {
  id: string;
  name: string;
}

function fmtElapsed(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((x) => String(x).padStart(2, "0")).join(":");
}

export function SessionRecorder() {
  const { data: sessions, mutate } = useSWR<Session[]>("/api/study-sessions", fetcher);
  const { data: subjects } = useSWR<SubjectOption[]>("/api/subjects", fetcher);

  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [subjectId, setSubjectId] = useState("");
  const [note, setNote] = useState("");

  const [mDate, setMDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [mMinutes, setMMinutes] = useState("30");
  const [mSubjectId, setMSubjectId] = useState("");
  const [mNote, setMNote] = useState("");

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  async function stop() {
    const minutes = Math.max(1, Math.round(elapsed / 60));
    await api("/api/study-sessions", {
      method: "POST",
      body: JSON.stringify({
        durationMinutes: minutes,
        subjectId: subjectId || null,
        note: note || null,
      }),
    });
    setRunning(false);
    setElapsed(0);
    setNote("");
    mutate();
  }

  async function manualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const minutes = Number(mMinutes);
    if (!(minutes > 0)) return alert("时长必须大于 0 分钟");
    const start = new Date(`${mDate}T12:00:00`);
    const end = new Date(start.getTime() + minutes * 60_000);
    await api("/api/study-sessions", {
      method: "POST",
      body: JSON.stringify({
        durationMinutes: minutes,
        subjectId: mSubjectId || null,
        note: mNote || null,
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
      }),
    });
    setMMinutes("30");
    setMNote("");
    mutate();
  }

  async function del(id: string) {
    if (!confirm("删除这条学习记录？")) return;
    await api(`/api/study-sessions/${id}`, { method: "DELETE" });
    mutate();
  }

  const subjectOptions = subjects ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">学习记录</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          记录每日学习时长，热力图与连续学习天数据此自动统计
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 计时器 */}
        <Card>
          <CardHeader>
            <CardTitle>专注计时</CardTitle>
            <CardDescription>开始后自动计时，结束时自动记录时长</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-5xl font-mono tabular-nums">{fmtElapsed(elapsed)}</div>
            <div className="space-y-2">
              <Label>科目（可选）</Label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={running}
              >
                <option value="">不指定科目</option>
                {subjectOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>备注（可选）</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：复习行列式" disabled={running} />
            </div>
            {running ? (
              <Button className="w-full" variant="destructive" onClick={stop}>
                <Square className="h-4 w-4" /> 结束并记录
              </Button>
            ) : (
              <Button className="w-full" onClick={() => setRunning(true)}>
                <Play className="h-4 w-4" /> 开始学习
              </Button>
            )}
          </CardContent>
        </Card>

        {/* 手动记录 */}
        <Card>
          <CardHeader>
            <CardTitle>手动记录</CardTitle>
            <CardDescription>补录过去某天的学习时长</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={manualSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>日期</Label>
                  <Input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>时长（分钟）</Label>
                  <Input type="number" min={1} value={mMinutes} onChange={(e) => setMMinutes(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>科目（可选）</Label>
                <select
                  value={mSubjectId}
                  onChange={(e) => setMSubjectId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">不指定科目</option>
                  {subjectOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>备注（可选）</Label>
                <Input value={mNote} onChange={(e) => setMNote(e.target.value)} placeholder="备注" />
              </div>
              <Button type="submit" variant="secondary" className="w-full">
                保存记录
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 历史记录 */}
      <Card>
        <CardHeader>
          <CardTitle>历史记录</CardTitle>
          <CardDescription>最近 100 条</CardDescription>
        </CardHeader>
        <CardContent>
          {!sessions ? (
            <p className="py-6 text-center text-sm text-muted-foreground">加载中…</p>
          ) : sessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">还没有学习记录</p>
          ) : (
            <ul className="divide-y">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {s.subjectName ?? "综合学习"}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {format(new Date(s.startedAt), "yyyy-MM-dd HH:mm")}
                      </span>
                    </p>
                    {s.note && <p className="truncate text-xs text-muted-foreground">{s.note}</p>}
                  </div>
                  <span className="text-sm font-medium tabular-nums">{s.durationMinutes} 分钟</span>
                  <button
                    onClick={() => del(s.id)}
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
