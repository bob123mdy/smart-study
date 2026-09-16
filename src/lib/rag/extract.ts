// 文件文本提取：支持 txt / md / pdf / docx。
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export type DocType = "txt" | "md" | "pdf" | "docx";

export function detectType(filename: string): DocType | null {
  const ext = (filename.toLowerCase().split(".").pop() ?? "").trim();
  if (ext === "txt") return "txt";
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  return null;
}

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  txt: "文本",
  md: "Markdown",
  pdf: "PDF",
  docx: "Word",
};

export async function extractText(filename: string, buffer: Buffer): Promise<string> {
  const type = detectType(filename);
  if (!type) throw new Error("仅支持 txt / md / pdf / docx 格式");

  if (type === "txt" || type === "md") {
    return buffer.toString("utf-8");
  }
  if (type === "pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    return result.text ?? "";
  }
  if (type === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? "";
  }
  return "";
}
