// 错题本元数据（纯常量，无 db 依赖，供服务端与客户端共用）

export const ERROR_TYPES = [
  { value: "concept", label: "概念混淆", emoji: "🧠" },
  { value: "calculation", label: "计算错误", emoji: "🔢" },
  { value: "careless", label: "粗心大意", emoji: "😅" },
  { value: "unknown", label: "其他", emoji: "❓" },
] as const;

export const ERROR_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ERROR_TYPES.map((t) => [t.value, t.label]),
);

export const ERROR_TYPE_EMOJI: Record<string, string> = Object.fromEntries(
  ERROR_TYPES.map((t) => [t.value, t.emoji]),
);

export const WQ_SOURCES = [
  { value: "manual", label: "手动录入" },
  { value: "exam", label: "考试/测验" },
  { value: "document", label: "资料库" },
] as const;

export const WQ_STATUSES = [
  { value: "unreviewed", label: "未复习" },
  { value: "reviewing", label: "复习中" },
  { value: "mastered", label: "已掌握" },
] as const;

export const WQ_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  WQ_STATUSES.map((s) => [s.value, s.label]),
);
