"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileJson, FileText, Layers } from "lucide-react";

const FORMATS = [
  {
    key: "markdown",
    title: "Markdown",
    desc: "人类可读的结构化笔记，含科目 / 目标 / 错题 / 记忆 / 学习记录，适合存档与迁移到笔记软件。",
    icon: FileText,
  },
  {
    key: "json",
    title: "JSON",
    desc: "完整原始数据（含复习日志与 FSRS 状态），适合备份与二次处理。",
    icon: FileJson,
  },
  {
    key: "anki",
    title: "Anki 卡片",
    desc: "错题 + 知识点制表符文件（TSV），Anki 桌面版「文件 → 导入」即可生成记忆卡片。",
    icon: Layers,
  },
] as const;

export function ExportManager() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">数据导出</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          你的学习数据归你所有。一键导出全部数据，随时带走。全程无需 AI。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {FORMATS.map((f) => {
          const Icon = f.icon;
          return (
            <Card key={f.key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4" /> {f.title}
                </CardTitle>
                <CardDescription>{f.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <a href={`/api/export/${f.key}`} download className="inline-block">
                  <Button>
                    <Download className="h-4 w-4" /> 下载 {f.title}
                  </Button>
                </a>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <strong>Markdown</strong>：导出为单个 .md 文件，可直接在 Obsidian / Typora / 语雀等打开。</p>
          <p>• <strong>JSON</strong>：导出为完整数据快照，字段与数据库结构一致。</p>
          <p>• <strong>Anki</strong>：导出为 .txt，Anki 桌面版「文件 → 导入」，字段映射为 Front / Back / Tags 即可。</p>
        </CardContent>
      </Card>
    </div>
  );
}
