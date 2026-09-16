// 复习评分档位 + 间隔格式化（纯常量/函数，无 db / 网络 / ts-fsrs 依赖，客户端可安全引入）。
// 评分值 1/3/4/5 为「应用层质量分」，服务端在 fsrs.ts 中映射到 FSRS 四档：Again/Hard/Good/Easy。

export const REVIEW_GRADES = [
  { value: 1, label: "重来", emoji: "🔁" },
  { value: 3, label: "困难", emoji: "😰" },
  { value: 4, label: "一般", emoji: "👍" },
  { value: 5, label: "简单", emoji: "🚀" },
] as const;

export function formatInterval(days: number): string {
  if (days <= 0) return "待复习";
  if (days < 1) return "今天";
  if (days === 1) return "1 天";
  if (days < 30) return `${days} 天`;
  if (days < 365) return `${Math.round(days / 30)} 个月`;
  return `${(days / 365).toFixed(1)} 年`;
}
