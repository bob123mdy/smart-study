// 老师能力元数据（纯常量，无 db 依赖）。
// 系统从「5 个独立老师」收敛为「1 位老师 5 种能力」；本表只作能力语义兜底，
// 交互能力按钮与能力标签统一以 src/lib/ai/prompts.ts 的 MODES/MODE_META 为准。

export const TEACHER_TYPE_META: Record<string, { label: string; emoji: string }> = {
  explainer: { label: "讲解", emoji: "🧑‍🏫" },
  quizzer: { label: "出题考核", emoji: "✍️" },
  grader: { label: "批改", emoji: "📝" },
  coach: { label: "教练规划", emoji: "🎯" },
  socratic: { label: "苏格拉底", emoji: "💭" },
};
