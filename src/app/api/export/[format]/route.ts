import { NextResponse } from "next/server";
import { exportMarkdown, exportJson, exportAnki } from "@/lib/export";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const META = {
  markdown: {
    type: "text/markdown; charset=utf-8",
    filename: "smart-study-export.md",
    gen: (uid: string) => exportMarkdown(uid),
  },
  json: {
    type: "application/json; charset=utf-8",
    filename: "smart-study-export.json",
    gen: async (uid: string) => JSON.stringify(await exportJson(uid), null, 2),
  },
  anki: {
    type: "text/tab-separated-values; charset=utf-8",
    filename: "smart-study-anki.txt",
    gen: (uid: string) => exportAnki(uid),
  },
} as const;

export async function GET(_req: Request, { params }: { params: { format: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const meta = META[params.format as keyof typeof META];
  if (!meta) return NextResponse.json({ error: "不支持的导出格式，可选 markdown / json / anki" }, { status: 400 });

  const content = await meta.gen(userId);
  return new NextResponse(content, {
    headers: {
      "Content-Type": meta.type,
      "Content-Disposition": `attachment; filename="${meta.filename}"`,
    },
  });
}
