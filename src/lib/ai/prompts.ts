// 交互模式与老师人格的提示词组装。
// 人格（teacher type）决定「谁在说话」；模式（mode）决定「怎么交互」。二者正交，最后拼成一条 system prompt。

export const MODES = ["explain", "quiz", "grader", "coach", "socratic", "course"] as const;
export type Mode = (typeof MODES)[number];

export const MODE_LABELS: Record<Mode, string> = {
  explain: "讲解",
  quiz: "出题考核",
  grader: "批改",
  coach: "教练规划",
  socratic: "苏格拉底",
  course: "带学",
};

// 能力元数据（emoji + 一句话描述）：老师页「1 位老师 5 种能力」与聊天室能力按钮共用
export const MODE_META: Record<Mode, { label: string; emoji: string; desc: string }> = {
  explain: { label: "讲解", emoji: "🧑‍🏫", desc: "把复杂概念讲透" },
  quiz: { label: "出题考核", emoji: "✍️", desc: "出题考察是否真懂" },
  grader: { label: "批改", emoji: "📝", desc: "客观评分、指出错因" },
  coach: { label: "教练规划", emoji: "🎯", desc: "规划节奏、督促进度" },
  socratic: { label: "苏格拉底", emoji: "💭", desc: "只提问引导独立思考" },
  course: { label: "带学", emoji: "🗺️", desc: "规划→讲解→考察→补漏一站式" },
};

const MODE_INSTRUCTIONS: Record<Mode, string> = {
  explain:
    "当前能力：讲解。请把用户询问的知识点讲透：先给直觉与类比，再给严谨定义，配生活化例子，最后总结要点。避免一次倾倒过多，循序渐进。",
  quiz: "当前能力：出题考核。请围绕目标知识点出题，由易到难，一次只出 1~2 道；先等用户作答，再逐题讲评并指出错因。不要一次性公布所有答案。",
  grader:
    "当前能力：批改。请客观评分，给出清晰可复现的评分标准，指出错因并归类（概念不清/计算错误/粗心/审题偏差）。",
  coach:
    "当前能力：教练规划。请帮用户规划学习节奏、督促进度，给出可执行、可量化的建议；也可请用户用自己的话复述概念（费曼检验）以查漏补缺。",
  socratic:
    "当前能力：苏格拉底诘问。只通过连续追问引导用户自己思考、自己得出结论，绝不直接给出答案或结论。每次最多问一个问题。",
  course:
    "当前能力：带学（完整学习闭环）。请围绕目标章节/知识点，由你主导节奏，自动推进「规划→学习→考察→查缺补漏」一条龙，全程无需用户点击任何按钮，用户只用自然语言回答或确认。\n" +
    "① 规划：先用一小段给出本章学习路径——列出知识点清单、建议顺序与预估用时，并点明各知识点之间的联系；规划完直接开始讲，不必等用户点头。\n" +
    "② 学习：按顺序逐个讲解（每次只聚焦 1 个知识点，先直觉类比再严谨定义，配例子，最后小结）；每讲完一个主动问一句「这部分清楚了吗？」，用户确认或复述后再进入下一个；不要一次倾倒全部内容。\n" +
    "③ 考察：讲完全部要点后，出 2~3 道题考察掌握情况（选择或简答皆可），一次只出 1 题，等用户作答后逐题讲评并判断是否真懂。\n" +
    "④ 查缺补漏：根据作答表现，明确指出薄弱知识点，针对性重讲或补一题，直到用户表示掌握；最后给本章总结与下一步学习建议，结束本轮带学。",
};

// 老师人格的基础人设（覆盖 seed 里的 systemPrompt，这里做语气兜底；seed 已有人设则直接使用）
export const TEACHER_TYPE_DEFAULT: Record<string, string> = {
  explainer: "你是一位耐心的讲解老师，善用类比与图示把复杂概念讲透。",
  quizzer: "你是一位出题老师，按知识点出题并考察是否真正理解。",
  grader: "你是一位批改老师，客观评分并给出清晰可复现的评分标准。",
  coach: "你是一位学习教练，规划节奏、督促进度，给出可执行可量化的建议。",
  socratic: "你采用苏格拉底诘问法，只提问，引导用户独立得出结论。",
};

/** 知识点上下文（含所属章节/科目与说明） */
export interface KpContext {
  name: string;
  description: string | null;
  chapter: string | null;
  subject: string | null;
}

/** 章节带学上下文：本章名称 + 知识点清单（含说明与掌握状态，供「查缺补漏」用） */
export interface ChapterContext {
  name: string;
  kps: { name: string; description: string | null; status: string }[];
}

const STATUS_LABEL: Record<string, string> = {
  not_started: "未开始",
  learning: "学习中",
  mastered: "已掌握",
};

/** 资料库检索到的一段材料 */
export interface SourceContext {
  title: string;
  content: string;
}

/** 组装系统提示词：共享画像 + 人格 + 模式 + 知识点上下文 + 资料库检索。 */
export function buildSystemPrompt(opts: {
  personaName: string;
  personaPrompt: string | null;
  personaType: string;
  mode: Mode;
  profile: string;
  knowledgePoint?: KpContext | null;
  chapter?: ChapterContext | null;
  sources?: SourceContext[];
}): string {
  const parts: string[] = [];

  parts.push(
    `你是「${opts.personaName}」，用户的私人学习伙伴。${opts.personaPrompt?.trim() || TEACHER_TYPE_DEFAULT[opts.personaType] || ""}`,
  );

  if (opts.chapter) {
    const kpLines = opts.chapter.kps
      .map(
        (k) =>
          `- ${k.name}（${STATUS_LABEL[k.status] ?? "未开始"}）` +
          (k.description ? `：${k.description}` : ""),
      )
      .join("\n");
    parts.push(
      `用户正在学习章节：${opts.chapter.name}。本章知识点清单与当前掌握状态如下，请据此规划讲解顺序、并在考察后对照定位薄弱点：\n${kpLines}`,
    );
  }

  if (opts.knowledgePoint) {
    const { name, description, chapter, subject } = opts.knowledgePoint;
    const lineage = [chapter, subject].filter(Boolean).join(" › ");
    parts.push(
      `用户当前聚焦的知识点：${name}${lineage ? `（所属：${lineage}）` : ""}。` +
        (description ? `\n知识点说明：${description}` : ""),
    );
  }

  if (opts.sources && opts.sources.length > 0) {
    const material = opts.sources
      .map((s, i) => `【资料${i + 1} · 来源《${s.title}》】\n${s.content}`)
      .join("\n\n");
    parts.push(
      `【用户资料库中检索到的相关材料（可能不完整，仅供参考）】\n${material}\n\n使用规则：优先依据上述材料回答；引用了某条材料时，在对应句子后用（来源：《标题》）注明；若材料不足以回答，明确说明并基于通用知识补充，切勿编造材料内容。`,
    );
  }

  parts.push(MODE_INSTRUCTIONS[opts.mode]);

  parts.push(
    `\n【关于用户的长期记忆与画像】\n${opts.profile}\n\n请始终依据上述画像作答；若画像信息不足，直接基于通用知识回答，不要编造用户的个人信息。`,
  );

  parts.push(
    "回答使用简体中文，语气友好、结构清晰；涉及公式用 Markdown 或纯文本可读形式书写。",
  );

  return parts.join("\n\n");
}
