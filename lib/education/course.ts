export const COURSE = {
  id: "0833032", name: "教育心理学", englishName: "Educational Psychology",
  term: "2026 秋季", hours: 32, credits: 2, version: "edu-v1.0",
  assessment: [{ label: "平时作业", weight: 20 }, { label: "期中作业", weight: 30 }, { label: "课程小论文", weight: 50 }],
};
export type Stage = "initial" | "revision" | "transfer" | "reflection";
export const STAGES: { id: Stage; title: string; short: string }[] = [
  { id: "initial", title: "先说说你的理解", short: "初始理解" },
  { id: "revision", title: "借助概念重新解释", short: "解释与修订" },
  { id: "transfer", title: "换个情境独立试试", short: "独立迁移" },
  { id: "reflection", title: "留下你的理解记录", short: "学习反思" },
];
export type Unit = { id: number; title: string; hours: number; group: number; concepts: string[]; objective: string; question: string; ready?: boolean };
export const GROUPS = ["理解学习者", "理解学习机制", "调节自己的学习", "设计与评价学习支持"];
export const UNITS: Unit[] = [
  { id: 1, title: "教育心理学导论", hours: 2, group: 0, concepts: ["理论与证据", "有意图的教学"], objective: "区分经验判断与有理论、研究证据支持的教育解释。", question: "熟悉的学习经验，为什么还需要理论来解释？" },
  { id: 2, title: "认知与语言发展", hours: 2, group: 0, concepts: ["皮亚杰", "维果茨基", "多语发展"], objective: "分析已有语言知识与社会互动对附加语言学习的作用。", question: "已有的语言知识怎样帮助或影响新语言学习？" },
  { id: 3, title: "自我、社会、情绪与道德发展", hours: 2, group: 0, concepts: ["自我概念", "身份", "交流意愿"], objective: "联系发展环境分析多语课堂中的身份与交流意愿。", question: "同一个学生，为什么在不同课堂里表现不同？" },
  { id: 4, title: "学习者差异与文化教育", hours: 2, group: 0, concepts: ["文化与学习", "学习者差异", "差异化支持"], objective: "提出跨文化、跨语言课堂的参与和支持方式，避免固定标签。", question: "怎样提供不同支持，而不把学生固定归类？" },
  { id: 5, title: "行为主义与社会学习", hours: 2, group: 1, concepts: ["强化", "惩罚", "观察学习"], objective: "分析表扬、纠错、示范和练习安排对语言学习行为的影响。", question: "一次表扬或纠错，究竟改变了什么？" },
  { id: 6, title: "认知学习、记忆与知识", hours: 2, group: 1, concepts: ["编码 encoding", "提取 retrieval", "认知负荷"], objective: "区分熟悉感与独立提取，并用课程概念解释词汇学习案例。", question: "看起来很熟，为什么还是想不起来？", ready: true },
  { id: 7, title: "建构主义与社会文化学习", hours: 2, group: 1, concepts: ["支架", "情境学习", "学习者能动性"], objective: "比较主动建构与社会共同建构，并分析对话和合作中的支持。", question: "与别人一起理解，和独自记住有什么不同？" },
  { id: 8, title: "动机、目标、信念与情绪", hours: 3, group: 2, concepts: ["自我决定", "归因", "自我效能", "焦虑"], objective: "用不同动机理论解释外语学习经历，提出支持自主与胜任感的方案。", question: "不愿开口，是不想学，还是有别的解释？" },
  { id: 9, title: "自我调节学习与学习策略", hours: 3, group: 2, concepts: ["计划", "监控", "控制", "评价"], objective: "制定可观察、可调整的一周语言学习计划，并设计检查依据。", question: "写了计划，怎样知道自己真的在学习？", ready: true },
  { id: 10, title: "问题解决、批判思考、创造性与迁移", hours: 2, group: 2, concepts: ["问题表征", "批判思考", "迁移"], objective: "分析语言与跨文化知识在新情境中的迁移条件。", question: "会做课堂练习，就一定能解决真实问题吗？" },
  { id: 11, title: "有效教学与教学设计", hours: 2, group: 3, concepts: ["教学目标", "活动与评价一致性"], objective: "设计目标、活动和学习证据相互一致的语言微型教学。", question: "怎样判断一个热闹的活动是否实现了学习目标？" },
  { id: 12, title: "学生中心、合作、差异化与技术辅助教学", hours: 2, group: 3, concepts: ["合作学习", "差异化", "数字素养"], objective: "为不同语言水平设计合作角色，并按学习目标选择技术工具。", question: "技术和合作，什么时候真正提供了学习支持？" },
  { id: 13, title: "学习环境与课堂管理", hours: 2, group: 3, concepts: ["规则与常规", "积极关系", "自我管理"], objective: "理解课堂规则、预防与沟通如何服务学习与自我管理。", question: "好的课堂规则，应该帮助学生做到什么？" },
  { id: 14, title: "促进学习与评定学习的评价", hours: 2, group: 3, concepts: ["形成性评价", "信度与效度", "量规"], objective: "为语言任务制定简短量规，检查评价的一致性与潜在偏差。", question: "一个分数，能告诉我们学生理解了什么吗？" },
  { id: 15, title: "综合回顾与课程总结", hours: 2, group: 3, concepts: ["理论整合", "情境化判断", "方案修订"], objective: "比较理论的解释范围，整合课程概念并修订语言学习或教学方案。", question: "怎样用一套有依据的解释，把这门课连接起来？" },
];
export type Task = {
  unitId: number; id: string; title: string; caseText: string; objective: string;
  prompts: Record<Stage, string>; hints: [string, string, string];
  concepts: { term: string; text: string }[]; criteria: string[]; source: string;
};
export const TASKS: Record<number, Task> = {
  6: {
    unitId: 6, id: "memory-vocabulary", title: "从“看着眼熟”到独立提取",
    caseText: "小林每天花半小时看外语词表。看到词和释义时，她觉得几乎都认识。合上词表做小测时，却想不起很多词的意思。她认为自己‘记忆力不好’，准备把看词表的时间加倍。",
    objective: "用记忆与学习的概念提出解释，并设计一种能检验解释的学习安排。",
    prompts: {
      initial: "你怎样解释小林的情况？请指出案例中实际观察到的现象，再写出你的解释。暂时不看提示，也不需要追求完整答案。",
      revision: "请用至少两个课程概念修订最初的解释。指出另一种可能的解释，并说明还需要什么证据。最后提出一个具体、可检查的改进尝试。",
      transfer: "新情境：小周看语法例句时能理解规则，但独立写邮件时常常用不出来。请独立解释：它与小林的情况有哪些相似和不同？你会怎样检验自己的判断？这一阶段不提供个性化提示。",
      reflection: "请完成三句话：我原来认为……；现在我修改为……，因为……；我仍不确定……，下一步会……。请用自己的语言，不必照抄 AI 的表述。",
    },
    hints: [
      "先把‘看到词表时的表现’与‘合上词表时的表现’分开。案例告诉了你什么，又有哪些原因尚未得到验证？",
      "尝试用‘编码’和‘提取’组织解释。辨认已有答案，与不看答案生成解释，是两种不同的任务；不要仅凭这个案例给学习者下能力结论。",
      "可以使用这个部分框架：观察是____；一种解释涉及____；另一种可能是____；我会比较____条件下的表现。请自行补充，并说明怎样记录变化。",
    ],
    concepts: [
      { term: "编码 encoding", text: "讨论信息如何被加工并与已有知识联系。分析时需要说明具体加工方式，而不只是重复概念名称。" },
      { term: "提取 retrieval", text: "讨论如何在当前任务和线索下取用已学信息。可以比较有提示与无提示时的表现，提出待检验的解释。" },
      { term: "观察与解释", text: "‘合上词表想不起’是案例中的观察；‘记忆力不好’是解释，不能仅由这一观察直接确证。" },
    ],
    criteria: ["区分案例观察与原因推断", "把至少两个概念连接到具体细节", "提出替代解释及所需证据", "提出可检查的改进尝试"],
    source: "课程大纲第六单元。案例、提示和概念简释为本分支原创教学草案，发布前由任课教师审核；不是教材原文引述。",
  },
  9: {
    unitId: 9, id: "self-regulated-week", title: "让一周语言学习计划可以被检查",
    caseText: "小陈计划每天练习外语口语 30 分钟。连续一周，她每天都打开学习软件，但有时只浏览视频。周末她觉得‘很努力却没有进步’，于是把下周目标改成每天练习 60 分钟。",
    objective: "区分投入时间与学习证据，设计包含计划、监控、调整和评价的一周学习方案。",
    prompts: {
      initial: "小陈的计划哪里需要进一步了解？请先解释你认为的问题，并区分案例事实与自己的猜测。",
      revision: "请修订解释，再为小陈设计一周方案：一个可观察的目标、一次学习中的检查、一个触发调整的条件，以及周末评价的依据。说明每个选择对应的课程概念。",
      transfer: "新情境：你需要在一周内准备一段跨文化交流的外语介绍，没有人每天提醒你。请独立制定一个不同于案例的方案，并说明遇到什么证据时会调整策略。此阶段不提供个性化提示。",
      reflection: "我原来把____当作进步；现在我会用____检查学习，因为____；一周后我会回来看____。请补充一个仍需验证的问题。",
    },
    hints: [
      "‘打开软件’能证明什么？要判断口语是否有变化，还需要看到什么？先明确想观察的学习表现。",
      "用计划、监控、控制与评价四个环节检查方案：目标是什么？过程中怎样检查？什么情况下改变方法？最后依据什么判断？",
      "部分框架：本周结束时我能____；每次练习后记录____；如果连续____次出现____，就调整____；周末用____与开始时的表现比较。请说明你的选择依据。",
    ],
    concepts: [
      { term: "计划 planning", text: "明确学习目标、任务、策略和资源。目标需要能连接到之后可以观察的表现。" },
      { term: "监控与控制", text: "监控是检查当前理解或进展；控制是根据检查结果调整策略、努力或资源。写出具体触发条件有助于让方案可检查。" },
      { term: "评价与反思", text: "根据目标和学习证据回顾表现，说明下一次保留或改变什么。时间投入与能力变化应分别记录。" },
    ],
    criteria: ["区分投入行为与学习证据", "目标可观察且范围适当", "包含监控和明确的调整条件", "评价依据与目标一致"],
    source: "课程大纲第九单元。案例、提示和概念简释为本分支原创教学草案，发布前由任课教师审核；不是教材原文引述。",
  },
};
export function getUnit(id: number) { return UNITS.find((unit) => unit.id === id); }
