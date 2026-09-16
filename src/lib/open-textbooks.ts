// 内置开放教材目录：预置真实章节结构的开放版权教材（OpenStax，CC BY 许可），点选即导入。
// 「下载整本教材」= 从目录一键导入「科目 → 章节 → 知识点」完整结构（离线可用、国内可访问、稳定）。
// 可自行增删条目扩展；结构复用 CurriculumStructure，直接交给 persistSubjectStructure 落库。

import type { CurriculumStructure } from "./ai/curriculum";

export interface OpenTextbook extends CurriculumStructure {
  id: string;
  aliases: string[];
  source: string;
}

export const OPEN_TEXTBOOKS: OpenTextbook[] = [
  {
    id: "calculus-vol1",
    aliases: ["微积分", "高等数学", "calculus"],
    subjectName: "微积分（Calculus Volume 1）",
    description: "函数、极限、导数与积分的核心内容",
    source: "OpenStax · CC BY 4.0",
    chapters: [
      { name: "函数与图像", knowledgePoints: ["函数与函数记号", "基本函数类", "三角函数", "反函数与对数函数"] },
      { name: "极限", knowledgePoints: ["极限的直观定义", "极限运算法则", "连续性"] },
      { name: "导数", knowledgePoints: ["导数与变化率", "求导法则", "三角函数的导数", "链式法则", "隐函数求导"] },
      { name: "导数的应用", knowledgePoints: ["相关变化率", "线性逼近与微分", "极值与最优化", "导数与函数图像"] },
      { name: "积分", knowledgePoints: ["面积与黎曼和", "定积分", "微积分基本定理", "换元积分法"] },
      { name: "积分的应用", knowledgePoints: ["曲线间面积", "旋转体体积", "弧长", "物理应用"] },
    ],
  },
  {
    id: "college-algebra-2e",
    aliases: ["大学代数", "代数", "algebra"],
    subjectName: "大学代数（College Algebra 2e）",
    description: "方程、函数、多项式与对数等代数基础",
    source: "OpenStax · CC BY 4.0",
    chapters: [
      { name: "预备知识", knowledgePoints: ["实数", "指数与科学计数法", "根式", "多项式"] },
      { name: "方程与不等式", knowledgePoints: ["线性方程", "复数", "二次方程", "不等式"] },
      { name: "函数", knowledgePoints: ["函数与函数记号", "定义域与值域", "函数变换", "反函数"] },
      { name: "线性函数", knowledgePoints: ["线性函数", "线性模型", "拟合直线"] },
      { name: "多项式与有理函数", knowledgePoints: ["二次函数", "幂函数与多项式函数", "有理函数"] },
      { name: "指数与对数函数", knowledgePoints: ["指数函数", "对数函数", "对数性质", "指数与对数方程"] },
      { name: "方程组与不等式组", knowledgePoints: ["线性方程组", "非线性方程组", "矩阵与消元法"] },
      { name: "解析几何", knowledgePoints: ["椭圆", "双曲线", "抛物线"] },
      { name: "数列、概率与计数", knowledgePoints: ["数列", "等差数列", "等比数列", "计数原理", "概率"] },
    ],
  },
  {
    id: "university-physics-vol1",
    aliases: ["大学物理", "物理学", "physics"],
    subjectName: "大学物理·力学（University Physics Vol.1）",
    description: "运动、力、能量、动量与流体力学",
    source: "OpenStax · CC BY 4.0",
    chapters: [
      { name: "单位与测量", knowledgePoints: ["物理量的测量", "单位与标准", "量纲分析", "有效数字"] },
      { name: "向量", knowledgePoints: ["标量与向量", "向量加减", "向量乘法", "坐标系"] },
      { name: "直线运动", knowledgePoints: ["位移与速度", "加速度", "匀加速运动", "自由落体"] },
      { name: "二维与三维运动", knowledgePoints: ["位移与速度向量", "加速度向量", "抛体运动", "匀速圆周运动"] },
      { name: "牛顿运动定律", knowledgePoints: ["力", "牛顿第一定律", "牛顿第二定律", "牛顿第三定律", "摩擦力"] },
      { name: "牛顿定律的应用", knowledgePoints: ["解运动问题", "圆周运动", "阻力与终端速度"] },
      { name: "功与动能", knowledgePoints: ["功", "动能", "功-能定理", "功率"] },
      { name: "势能与能量守恒", knowledgePoints: ["势能", "保守力与非保守力", "机械能守恒"] },
      { name: "动量与碰撞", knowledgePoints: ["动量", "冲量", "动量守恒", "碰撞"] },
      { name: "定轴转动", knowledgePoints: ["角量与线量", "转动惯量", "转动动能", "力矩与转动定律"] },
      { name: "角动量", knowledgePoints: ["角动量", "角动量守恒", "刚体角动量"] },
      { name: "万有引力", knowledgePoints: ["万有引力定律", "重力", "引力势能", "行星运动"] },
      { name: "流体力学", knowledgePoints: ["压强", "流体静力学", "浮力", "伯努利方程"] },
    ],
  },
  {
    id: "introductory-statistics",
    aliases: ["统计学", "概率统计", "statistics"],
    subjectName: "统计学（Introductory Statistics）",
    description: "描述统计、概率、抽样分布与推断",
    source: "OpenStax · CC BY 4.0",
    chapters: [
      { name: "抽样与数据", knowledgePoints: ["统计学术语", "数据抽样", "实验设计", "数据类型"] },
      { name: "描述统计", knowledgePoints: ["数据展示", "集中趋势度量", "离散程度度量"] },
      { name: "概率论基础", knowledgePoints: ["概率定义", "独立与互斥事件", "条件概率", "计数规则"] },
      { name: "离散随机变量", knowledgePoints: ["离散概率分布", "二项分布", "泊松分布"] },
      { name: "连续随机变量", knowledgePoints: ["连续概率分布", "均匀分布", "指数分布"] },
      { name: "正态分布", knowledgePoints: ["正态分布性质", "标准正态分布", "正态分布应用"] },
      { name: "中心极限定理", knowledgePoints: ["样本均值的分布", "中心极限定理"] },
      { name: "置信区间", knowledgePoints: ["点估计", "总体均值的置信区间", "总体比例的置信区间"] },
      { name: "假设检验", knowledgePoints: ["假设检验基础", "单样本检验", "双样本检验"] },
      { name: "线性回归与相关", knowledgePoints: ["散点图", "相关系数", "线性回归", "回归推断"] },
    ],
  },
  {
    id: "principles-of-economics-3e",
    aliases: ["经济学", "经济学原理", "economics"],
    subjectName: "经济学原理（Principles of Economics）",
    description: "微观经济学核心：供需、市场结构与外部性",
    source: "OpenStax · CC BY 4.0",
    chapters: [
      { name: "经济学基本概念", knowledgePoints: ["什么是经济学", "稀缺与选择", "微观与宏观"] },
      { name: "需求与供给", knowledgePoints: ["需求", "供给", "市场均衡"] },
      { name: "弹性", knowledgePoints: ["需求价格弹性", "其它弹性", "弹性应用"] },
      { name: "消费者选择", knowledgePoints: ["效用", "预算约束", "消费者均衡"] },
      { name: "生产与成本", knowledgePoints: ["生产函数", "短期成本", "长期成本"] },
      { name: "完全竞争", knowledgePoints: ["完全竞争市场", "利润最大化", "长期均衡"] },
      { name: "垄断", knowledgePoints: ["垄断成因", "垄断定价", "价格歧视"] },
      { name: "垄断竞争与寡头", knowledgePoints: ["垄断竞争", "寡头", "博弈论基础"] },
      { name: "劳动与金融市场", knowledgePoints: ["劳动需求与供给", "工资", "资本市场"] },
      { name: "外部性与公共物品", knowledgePoints: ["外部性", "公共物品", "政府干预"] },
    ],
  },
  {
    id: "psychology-2e",
    aliases: ["心理学", "psychology"],
    subjectName: "心理学（Psychology 2e）",
    description: "心理学导论：生物基础、认知、动机与人际",
    source: "OpenStax · CC BY 4.0",
    chapters: [
      { name: "心理学导论", knowledgePoints: ["心理学历史", "当代心理学", "研究设计"] },
      { name: "心理学研究方法", knowledgePoints: ["科学方法", "描述性研究", "相关与实验"] },
      { name: "生物心理学", knowledgePoints: ["神经元", "神经系统", "大脑结构"] },
      { name: "意识状态", knowledgePoints: ["睡眠", "梦境", "意识改变状态"] },
      { name: "感觉与知觉", knowledgePoints: ["视觉", "听觉", "其它感觉", "知觉"] },
      { name: "学习", knowledgePoints: ["经典条件反射", "操作性条件反射", "观察学习"] },
      { name: "记忆", knowledgePoints: ["记忆的编码储存与提取", "记忆类型", "遗忘"] },
      { name: "思维与智力", knowledgePoints: ["认知", "语言", "智力测量"] },
      { name: "动机与情绪", knowledgePoints: ["动机理论", "饥饿与进食", "情绪"] },
      { name: "人格", knowledgePoints: ["人格理论", "人格测量"] },
      { name: "心理障碍", knowledgePoints: ["心理障碍分类", "焦虑障碍", "心境障碍"] },
      { name: "治疗", knowledgePoints: ["心理治疗", "生物治疗"] },
    ],
  },
];

/** 目录精简视图（供前端列表展示，不下发全部知识点） */
export function catalogSummary() {
  return OPEN_TEXTBOOKS.map((b) => ({
    id: b.id,
    title: b.subjectName,
    source: b.source,
    chapterCount: b.chapters.length,
    knowledgePointCount: b.chapters.reduce((n, c) => n + c.knowledgePoints.length, 0),
  }));
}
