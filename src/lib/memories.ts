// 记忆类别元数据（纯常量，无 db 依赖，供服务端 profile 与客户端页面共用）

export const MEMORY_CATEGORIES = [
  { value: "weak_point", label: "薄弱知识点", emoji: "🧩" },
  { value: "error_pattern", label: "易错类型", emoji: "⚠️" },
  { value: "preference", label: "学习偏好", emoji: "💡" },
  { value: "habit", label: "作息习惯", emoji: "⏰" },
] as const;

export const MEMORY_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  MEMORY_CATEGORIES.map((c) => [c.value, c.label]),
);

export const MEMORY_CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  MEMORY_CATEGORIES.map((c) => [c.value, c.emoji]),
);
