// 极简 Markdown 渲染（纯 React 元素，不 dangerouslySetInnerHTML，安全）。
// 支持：标题、无序/有序列表、fenced 代码块、行内 code、**加粗**、换行分段。

import React from "react";

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
      return (
        <strong key={`${keyBase}-${i}`} className="font-semibold">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) {
      return (
        <code
          key={`${keyBase}-${i}`}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]"
        >
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={`${keyBase}-${i}`}>{p}</span>;
  });
}

export const Markdown = React.memo(function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let inCode = false;
  let codeBuf: string[] = [];
  let para: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (para.length) {
      nodes.push(
        <p key={`p-${key++}`} className="whitespace-pre-wrap">
          {renderInline(para.join("\n"), `p-${key}`)}
        </p>,
      );
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.trimStart().startsWith("```")) {
      flushPara();
      if (!inCode) {
        inCode = true;
        codeBuf = [];
      } else {
        nodes.push(
          <pre
            key={`pre-${key++}`}
            className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed"
          >
            <code>{codeBuf.join("\n")}</code>
          </pre>,
        );
        inCode = false;
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      i++;
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      i++;
      continue;
    }
    if (/^#{1,4}\s/.test(line)) {
      flushPara();
      nodes.push(
        <p key={`h-${key++}`} className="text-base font-semibold">
          {renderInline(line.replace(/^#+\s/, ""), `h-${key}`)}
        </p>,
      );
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      nodes.push(
        <ul key={`ul-${key++}`} className="list-disc space-y-1 pl-5">
          {items.map((it, k) => (
            <li key={k} className="whitespace-pre-wrap">
              {renderInline(it, `ul-${key}-${k}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${key++}`} className="list-decimal space-y-1 pl-5">
          {items.map((it, k) => (
            <li key={k} className="whitespace-pre-wrap">
              {renderInline(it, `ol-${key}-${k}`)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }
    para.push(line);
    i++;
  }
  flushPara();
  if (inCode && codeBuf.length) {
    nodes.push(
      <pre key={`pre-${key++}`} className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
        <code>{codeBuf.join("\n")}</code>
      </pre>,
    );
  }

  return <div className="space-y-2">{nodes}</div>;
});
