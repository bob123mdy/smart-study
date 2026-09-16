// 内置词库数据 + 幂等写入。内置词库 user_id 为空（全局共享，不属于任何用户），
// 所有用户都能背；自定义词库 user_id 归属具体用户。
import { and, eq } from "drizzle-orm";
import { db, newId } from "./index";
import { wordbooks, words } from "./schema";

export interface BuiltinWord {
  word: string;
  phonetic: string;
  meaning: string;
  example?: string;
  exampleMeaning?: string;
}

export const BUILTIN_WORDBOOK_NAME = "英语高频核心词";

export const BUILTIN_WORDS: BuiltinWord[] = [
  { word: "abandon", phonetic: "/əˈbændən/", meaning: "v. 放弃；抛弃", example: "He abandoned the plan.", exampleMeaning: "他放弃了这个计划。" },
  { word: "ability", phonetic: "/əˈbɪləti/", meaning: "n. 能力", example: "She has the ability to lead.", exampleMeaning: "她有领导能力。" },
  { word: "access", phonetic: "/ˈækses/", meaning: "n. 通道；v. 访问", example: "Students need access to books.", exampleMeaning: "学生需要能接触到书。" },
  { word: "achieve", phonetic: "/əˈtʃiːv/", meaning: "v. 实现；达到", example: "Work hard to achieve your goal.", exampleMeaning: "努力实现你的目标。" },
  { word: "acquire", phonetic: "/əˈkwaɪər/", meaning: "v. 获得；习得", example: "Children acquire language quickly.", exampleMeaning: "孩子学语言很快。" },
  { word: "adapt", phonetic: "/əˈdæpt/", meaning: "v. 适应；改编", example: "You must adapt to change.", exampleMeaning: "你必须适应变化。" },
  { word: "adequate", phonetic: "/ˈædɪkwət/", meaning: "adj. 充足的；适当的", example: "The food was adequate for all.", exampleMeaning: "食物够所有人吃。" },
  { word: "adjust", phonetic: "/əˈdʒʌst/", meaning: "v. 调整；适应", example: "Adjust the chair height.", exampleMeaning: "调整椅子高度。" },
  { word: "admire", phonetic: "/ədˈmaɪər/", meaning: "v. 钦佩；欣赏", example: "I admire her courage.", exampleMeaning: "我钦佩她的勇气。" },
  { word: "adopt", phonetic: "/əˈdɑːpt/", meaning: "v. 采纳；收养", example: "They adopted a new method.", exampleMeaning: "他们采用了新方法。" },
  { word: "advantage", phonetic: "/ədˈvæntɪdʒ/", meaning: "n. 优势；好处", example: "Speaking English is an advantage.", exampleMeaning: "会说英语是优势。" },
  { word: "affect", phonetic: "/əˈfekt/", meaning: "v. 影响", example: "Weather affects our mood.", exampleMeaning: "天气影响心情。" },
  { word: "afford", phonetic: "/əˈfɔːrd/", meaning: "v. 负担得起", example: "I can't afford a new car.", exampleMeaning: "我买不起新车。" },
  { word: "alternative", phonetic: "/ɔːlˈtɜːrnətɪv/", meaning: "n. 选择；adj. 替代的", example: "We have no alternative.", exampleMeaning: "我们没有别的选择。" },
  { word: "ambition", phonetic: "/æmˈbɪʃn/", meaning: "n. 雄心；抱负", example: "Her ambition is to be a doctor.", exampleMeaning: "她的抱负是当医生。" },
  { word: "analyze", phonetic: "/ˈænəlaɪz/", meaning: "v. 分析", example: "Analyze the data carefully.", exampleMeaning: "仔细分析数据。" },
  { word: "ancient", phonetic: "/ˈeɪnʃənt/", meaning: "adj. 古代的", example: "We visited an ancient temple.", exampleMeaning: "我们参观了一座古庙。" },
  { word: "anxiety", phonetic: "/æŋˈzaɪəti/", meaning: "n. 焦虑；担心", example: "He felt anxiety before the exam.", exampleMeaning: "考试前他感到焦虑。" },
  { word: "apparent", phonetic: "/əˈpærənt/", meaning: "adj. 明显的", example: "It was apparent she was tired.", exampleMeaning: "很明显她累了。" },
  { word: "appeal", phonetic: "/əˈpiːl/", meaning: "v. 呼吁；吸引", example: "The idea appeals to me.", exampleMeaning: "这个想法吸引我。" },
  { word: "appreciate", phonetic: "/əˈpriːʃieɪt/", meaning: "v. 感激；欣赏", example: "I appreciate your help.", exampleMeaning: "我感激你的帮助。" },
  { word: "approach", phonetic: "/əˈproʊtʃ/", meaning: "n. 方法；v. 接近", example: "Let's try a new approach.", exampleMeaning: "我们试试新方法。" },
  { word: "appropriate", phonetic: "/əˈproʊpriət/", meaning: "adj. 适当的", example: "Wear appropriate clothes.", exampleMeaning: "穿合适的衣服。" },
  { word: "approve", phonetic: "/əˈpruːv/", meaning: "v. 批准；赞成", example: "The boss approved the plan.", exampleMeaning: "老板批准了这个计划。" },
  { word: "argue", phonetic: "/ˈɑːrɡjuː/", meaning: "v. 争论；主张", example: "They argued about money.", exampleMeaning: "他们为钱争吵。" },
  { word: "arrange", phonetic: "/əˈreɪndʒ/", meaning: "v. 安排；整理", example: "I'll arrange a meeting.", exampleMeaning: "我会安排会议。" },
  { word: "assess", phonetic: "/əˈses/", meaning: "v. 评估", example: "Teachers assess students' work.", exampleMeaning: "老师评估学生作业。" },
  { word: "assist", phonetic: "/əˈsɪst/", meaning: "v. 协助", example: "Can I assist you?", exampleMeaning: "我能帮你吗？" },
  { word: "assume", phonetic: "/əˈsuːm/", meaning: "v. 假设；承担", example: "I assume you're right.", exampleMeaning: "我假定你是对的。" },
  { word: "attach", phonetic: "/əˈtætʃ/", meaning: "v. 附上；重视", example: "Attach the file to the email.", exampleMeaning: "把文件附到邮件里。" },
  { word: "attitude", phonetic: "/ˈætɪtuːd/", meaning: "n. 态度", example: "A positive attitude helps.", exampleMeaning: "积极的态度有帮助。" },
  { word: "attract", phonetic: "/əˈtrækt/", meaning: "v. 吸引", example: "The show attracts many people.", exampleMeaning: "这场演出吸引了很多人。" },
  { word: "authority", phonetic: "/əˈθɔːrəti/", meaning: "n. 权威；当局", example: "He is an authority on history.", exampleMeaning: "他是历史权威。" },
  { word: "available", phonetic: "/əˈveɪləbl/", meaning: "adj. 可获得的；有空的", example: "Tickets are available online.", exampleMeaning: "票可在网上购买。" },
  { word: "avoid", phonetic: "/əˈvɔɪd/", meaning: "v. 避免", example: "Avoid making the same mistake.", exampleMeaning: "避免犯同样的错误。" },
  { word: "aware", phonetic: "/əˈwer/", meaning: "adj. 意识到的", example: "Be aware of the danger.", exampleMeaning: "要意识到危险。" },
  { word: "benefit", phonetic: "/ˈbenɪfɪt/", meaning: "n. 好处；v. 受益", example: "Exercise benefits your health.", exampleMeaning: "锻炼有益健康。" },
  { word: "challenge", phonetic: "/ˈtʃælɪndʒ/", meaning: "n. 挑战；v. 质疑", example: "Learning a language is a challenge.", exampleMeaning: "学语言是个挑战。" },
  { word: "circumstance", phonetic: "/ˈsɜːrkəmstæns/", meaning: "n. 情况；环境", example: "Under no circumstances give up.", exampleMeaning: "任何情况下都不要放弃。" },
  { word: "combine", phonetic: "/kəmˈbaɪn/", meaning: "v. 结合", example: "Combine theory with practice.", exampleMeaning: "把理论与实践结合。" },
  { word: "comment", phonetic: "/ˈkɑːment/", meaning: "n./v. 评论", example: "Do you have any comment?", exampleMeaning: "你有什么评论吗？" },
  { word: "commit", phonetic: "/kəˈmɪt/", meaning: "v. 承诺；犯（错）", example: "He committed to the project.", exampleMeaning: "他投入到这个项目中。" },
  { word: "community", phonetic: "/kəˈmjuːnəti/", meaning: "n. 社区；群体", example: "We live in a small community.", exampleMeaning: "我们住在一个小社区。" },
  { word: "compare", phonetic: "/kəmˈper/", meaning: "v. 比较", example: "Compare the two answers.", exampleMeaning: "比较这两个答案。" },
  { word: "compete", phonetic: "/kəmˈpiːt/", meaning: "v. 竞争", example: "Teams compete for the prize.", exampleMeaning: "各队竞争奖项。" },
  { word: "complex", phonetic: "/kəmˈpleks/", meaning: "adj. 复杂的", example: "It's a complex problem.", exampleMeaning: "这是个复杂的问题。" },
  { word: "concentrate", phonetic: "/ˈkɑːnsntreɪt/", meaning: "v. 集中（注意力）", example: "Concentrate on your study.", exampleMeaning: "专心学习。" },
  { word: "concept", phonetic: "/ˈkɑːnsept/", meaning: "n. 概念", example: "Explain the basic concept.", exampleMeaning: "解释基本概念。" },
  { word: "concern", phonetic: "/kənˈsɜːrn/", meaning: "n. 担忧；v. 涉及", example: "This issue concerns everyone.", exampleMeaning: "这个问题关系到每个人。" },
  { word: "conclude", phonetic: "/kənˈkluːd/", meaning: "v. 得出结论；结束", example: "The study concluded that it works.", exampleMeaning: "研究得出结论它有效。" },
  { word: "conduct", phonetic: "/kənˈdʌkt/", meaning: "v. 进行；引导", example: "They conducted an experiment.", exampleMeaning: "他们进行了一项实验。" },
  { word: "confident", phonetic: "/ˈkɑːnfɪdənt/", meaning: "adj. 自信的", example: "Be confident in yourself.", exampleMeaning: "要对自己有信心。" },
  { word: "confirm", phonetic: "/kənˈfɜːrm/", meaning: "v. 确认；证实", example: "Please confirm the time.", exampleMeaning: "请确认时间。" },
  { word: "conflict", phonetic: "/ˈkɑːnflɪkt/", meaning: "n. 冲突；矛盾", example: "They resolved the conflict.", exampleMeaning: "他们解决了冲突。" },
  { word: "consequence", phonetic: "/ˈkɑːnsɪkwens/", meaning: "n. 后果", example: "Think about the consequences.", exampleMeaning: "想想后果。" },
  { word: "considerable", phonetic: "/kənˈsɪdərəbl/", meaning: "adj. 相当大的", example: "It took considerable effort.", exampleMeaning: "这花了相当大的力气。" },
  { word: "consist", phonetic: "/kənˈsɪst/", meaning: "v. 由…组成", example: "The team consists of five people.", exampleMeaning: "队伍由五人组成。" },
  { word: "constant", phonetic: "/ˈkɑːnstənt/", meaning: "adj. 持续的；不变的", example: "The noise was constant.", exampleMeaning: "噪音持续不断。" },
  { word: "construct", phonetic: "/kənˈstrʌkt/", meaning: "v. 建造；构建", example: "They constructed a bridge.", exampleMeaning: "他们建了一座桥。" },
  { word: "consume", phonetic: "/kənˈsuːm/", meaning: "v. 消耗；消费", example: "Cars consume much fuel.", exampleMeaning: "汽车消耗大量燃料。" },
  { word: "contain", phonetic: "/kənˈteɪn/", meaning: "v. 包含", example: "The box contains books.", exampleMeaning: "箱子里装着书。" },
  { word: "contribute", phonetic: "/kənˈtrɪbjuːt/", meaning: "v. 贡献；促成", example: "Everyone can contribute ideas.", exampleMeaning: "每个人都能贡献想法。" },
  { word: "convince", phonetic: "/kənˈvɪns/", meaning: "v. 说服；使相信", example: "He convinced me to stay.", exampleMeaning: "他说服我留下。" },
  { word: "crucial", phonetic: "/ˈkruːʃl/", meaning: "adj. 关键的", example: "This step is crucial.", exampleMeaning: "这一步很关键。" },
  { word: "decline", phonetic: "/dɪˈklaɪn/", meaning: "v. 下降；拒绝", example: "Prices declined last month.", exampleMeaning: "上个月价格下降了。" },
  { word: "define", phonetic: "/dɪˈfaɪn/", meaning: "v. 定义；界定", example: "Define the key terms.", exampleMeaning: "定义关键术语。" },
  { word: "demonstrate", phonetic: "/ˈdemənstreɪt/", meaning: "v. 证明；演示", example: "He demonstrated how it works.", exampleMeaning: "他演示了它是如何工作的。" },
  { word: "depend", phonetic: "/dɪˈpend/", meaning: "v. 依赖；取决于", example: "Success depends on effort.", exampleMeaning: "成功取决于努力。" },
  { word: "desire", phonetic: "/dɪˈzaɪər/", meaning: "n. 渴望；愿望", example: "She has a desire to learn.", exampleMeaning: "她有学习的渴望。" },
  { word: "determine", phonetic: "/dɪˈtɜːrmɪn/", meaning: "v. 决定；确定", example: "Your actions determine the result.", exampleMeaning: "你的行动决定结果。" },
  { word: "develop", phonetic: "/dɪˈveləp/", meaning: "v. 发展；培养", example: "Reading develops your mind.", exampleMeaning: "阅读能培养思维。" },
  { word: "distinguish", phonetic: "/dɪˈstɪŋɡwɪʃ/", meaning: "v. 区分；辨别", example: "Can you distinguish the two sounds?", exampleMeaning: "你能分辨这两个音吗？" },
  { word: "distribute", phonetic: "/dɪˈstrɪbjuːt/", meaning: "v. 分配；分发", example: "They distributed food to the poor.", exampleMeaning: "他们给穷人分发食物。" },
  { word: "diverse", phonetic: "/daɪˈvɜːrs/", meaning: "adj. 多样的", example: "The city has diverse cultures.", exampleMeaning: "这座城市文化多元。" },
  { word: "efficient", phonetic: "/ɪˈfɪʃnt/", meaning: "adj. 高效的", example: "This method is efficient.", exampleMeaning: "这个方法很高效。" },
  { word: "eliminate", phonetic: "/ɪˈlɪmɪneɪt/", meaning: "v. 消除；淘汰", example: "Eliminate all errors.", exampleMeaning: "消除所有错误。" },
  { word: "emphasize", phonetic: "/ˈemfəsaɪz/", meaning: "v. 强调", example: "He emphasized the importance of practice.", exampleMeaning: "他强调了练习的重要性。" },
  { word: "employ", phonetic: "/ɪmˈplɔɪ/", meaning: "v. 雇用；使用", example: "The company employs 500 workers.", exampleMeaning: "这家公司雇了500名工人。" },
  { word: "encourage", phonetic: "/ɪnˈkɜːrɪdʒ/", meaning: "v. 鼓励", example: "Parents encourage their children.", exampleMeaning: "父母鼓励孩子。" },
  { word: "enhance", phonetic: "/ɪnˈhæns/", meaning: "v. 增强；提高", example: "Reading enhances knowledge.", exampleMeaning: "阅读增进知识。" },
  { word: "ensure", phonetic: "/ɪnˈʃʊr/", meaning: "v. 确保", example: "Please ensure the door is locked.", exampleMeaning: "请确保门锁好了。" },
  { word: "essential", phonetic: "/ɪˈsenʃl/", meaning: "adj. 必要的；本质的", example: "Water is essential to life.", exampleMeaning: "水对生命至关重要。" },
  { word: "establish", phonetic: "/ɪˈstæblɪʃ/", meaning: "v. 建立", example: "They established a new school.", exampleMeaning: "他们建立了一所新学校。" },
  { word: "evaluate", phonetic: "/ɪˈvæljueɪt/", meaning: "v. 评估", example: "Evaluate the results carefully.", exampleMeaning: "仔细评估结果。" },
  { word: "evident", phonetic: "/ˈevɪdənt/", meaning: "adj. 明显的", example: "It is evident that he is honest.", exampleMeaning: "很明显他是诚实的。" },
  { word: "expand", phonetic: "/ɪkˈspænd/", meaning: "v. 扩大；扩张", example: "The business is expanding.", exampleMeaning: "生意在扩张。" },
  { word: "explore", phonetic: "/ɪkˈsplɔːr/", meaning: "v. 探索", example: "We explored the old city.", exampleMeaning: "我们探索了老城。" },
  { word: "expose", phonetic: "/ɪkˈspoʊz/", meaning: "v. 暴露；使接触", example: "Expose children to good books.", exampleMeaning: "让孩子接触好书。" },
  { word: "facilitate", phonetic: "/fəˈsɪlɪteɪt/", meaning: "v. 促进；使便利", example: "Tools facilitate learning.", exampleMeaning: "工具促进学习。" },
  { word: "flexible", phonetic: "/ˈfleksəbl/", meaning: "adj. 灵活的", example: "My schedule is flexible.", exampleMeaning: "我的时间表很灵活。" },
  { word: "focus", phonetic: "/ˈfoʊkəs/", meaning: "v. 聚焦；n. 焦点", example: "Focus on your goals.", exampleMeaning: "专注于你的目标。" },
  { word: "fundamental", phonetic: "/ˌfʌndəˈmentl/", meaning: "adj. 基本的；根本的", example: "This is a fundamental rule.", exampleMeaning: "这是基本规则。" },
  { word: "generate", phonetic: "/ˈdʒenəreɪt/", meaning: "v. 产生；生成", example: "The plan generated interest.", exampleMeaning: "这个计划引起了兴趣。" },
  { word: "genuine", phonetic: "/ˈdʒenjuɪn/", meaning: "adj. 真正的；真诚的", example: "She showed genuine concern.", exampleMeaning: "她表现出真诚的关心。" },
  { word: "guarantee", phonetic: "/ˌɡærənˈtiː/", meaning: "v. 保证；n. 担保", example: "We guarantee the quality.", exampleMeaning: "我们保证质量。" },
  { word: "identify", phonetic: "/aɪˈdentɪfaɪ/", meaning: "v. 识别；确认", example: "Identify the main idea.", exampleMeaning: "找出主旨。" },
  { word: "ignore", phonetic: "/ɪɡˈnɔːr/", meaning: "v. 忽视", example: "Don't ignore the warning.", exampleMeaning: "不要忽视警告。" },
  { word: "illustrate", phonetic: "/ˈɪləstreɪt/", meaning: "v. 说明；举例", example: "The chart illustrates the trend.", exampleMeaning: "图表说明了趋势。" },
  { word: "impact", phonetic: "/ˈɪmpækt/", meaning: "n. 影响；冲击", example: "Technology has a big impact.", exampleMeaning: "科技影响巨大。" },
  { word: "imply", phonetic: "/ɪmˈplaɪ/", meaning: "v. 暗示；意味着", example: "Silence implies agreement.", exampleMeaning: "沉默意味着同意。" },
];

/** 幂等写入内置词库（仅当不存在时）。内置词库 user_id 为空，全局共享。 */
export async function seedBuiltinVocabulary(): Promise<void> {
  const existing = await db
    .select({ id: wordbooks.id })
    .from(wordbooks)
    .where(and(eq(wordbooks.isBuiltin, true), eq(wordbooks.name, BUILTIN_WORDBOOK_NAME)))
    .get();
  if (existing) return;

  const bookId = newId();
  await db
    .insert(wordbooks)
    .values({
      id: bookId,
      userId: null,
      name: BUILTIN_WORDBOOK_NAME,
      description: "英语高频核心词汇（内置词库）",
      isBuiltin: true,
      source: "builtin",
      sortOrder: 0,
    })
    .run();

  for (const [i, w] of BUILTIN_WORDS.entries()) {
    await db
      .insert(words)
      .values({
        id: newId(),
        wordbookId: bookId,
        word: w.word,
        phonetic: w.phonetic,
        meaning: w.meaning,
        example: w.example ?? null,
        exampleMeaning: w.exampleMeaning ?? null,
        tags: null,
        sortOrder: i + 1,
      })
      .run();
  }
  console.log(`[vocab] 内置词库已写入：${BUILTIN_WORDS.length} 词`);
}
