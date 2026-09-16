// 文本切分：先按段落聚合，超长段落按字符硬切并保留重叠，用于检索粒度与上下文完整性。

const DEFAULT_SIZE = 800;
const DEFAULT_OVERLAP = 120;

export function chunkText(text: string, chunkSize = DEFAULT_SIZE, overlap = DEFAULT_OVERLAP): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";

  const push = (piece: string) => {
    const t = piece.trim();
    if (t) chunks.push(t);
  };

  for (const p of paragraphs) {
    const para = p.trim();
    if (!para) continue;

    if (current.length + para.length + 2 <= chunkSize) {
      current = current ? `${current}\n\n${para}` : para;
    } else {
      push(current);
      if (para.length <= chunkSize) {
        current = para;
      } else {
        // 超长段落：按 chunkSize 硬切，保留 overlap
        let start = 0;
        while (start < para.length) {
          push(para.slice(start, start + chunkSize));
          if (start + chunkSize >= para.length) break;
          start += chunkSize - overlap;
        }
        current = "";
      }
    }
  }
  push(current);

  return chunks;
}
