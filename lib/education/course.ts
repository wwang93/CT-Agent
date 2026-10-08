export const COURSE = {
  id: "0833032", name: "教育心理学", englishName: "Educational Psychology",
  term: "2026 秋季", hours: 32, credits: 2, version: "edu-v1.1-five-interventions",
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
  { id: 6, title: "认知学习、记忆与知识", hours: 2, group: 1, concepts: ["注意", "认知负荷", "意义编码", "提取练习"], objective: "分析一次语言学习经历，用具体证据解释即时表现与持久可用知识的区别。", question: "学的时候会，为什么后来用不出来？", ready: true },
  { id: 7, title: "建构主义与社会文化学习", hours: 2, group: 1, concepts: ["支架", "情境学习", "学习者能动性"], objective: "比较主动建构与社会共同建构，并分析对话和合作中的支持。", question: "与别人一起理解，和独自记住有什么不同？" },
  { id: 8, title: "动机、目标、信念与情绪", hours: 3, group: 2, concepts: ["自我决定", "归因", "自我效能", "焦虑"], objective: "用不同动机理论解释外语学习经历，提出支持自主与胜任感的方案。", question: "不愿开口，是不想学，还是有别的解释？" },
  { id: 9, title: "自我调节学习与学习策略", hours: 3, group: 2, concepts: ["计划", "监控", "控制", "评价"], objective: "制定可观察、可调整的一周语言学习计划，并设计检查依据。", question: "写了计划，怎样知道自己真的在学习？" },
  { id: 10, title: "问题解决、批判思考、创造性与迁移", hours: 2, group: 2, concepts: ["问题表征", "证据评价", "发散与聚合", "迁移"], objective: "重新表征沟通问题，评价证据、比较方案，并在新情境中独立应用原则。", question: "最初的判断可靠吗？还有哪些解决方案？", ready: true },
  { id: 11, title: "有效教学与教学设计", hours: 2, group: 3, concepts: ["教学目标", "活动与评价一致性"], objective: "设计目标、活动和学习证据相互一致的语言微型教学。", question: "怎样判断一个热闹的活动是否实现了学习目标？" },
  { id: 12, title: "学生中心、合作、差异化与技术辅助教学", hours: 2, group: 3, concepts: ["合作学习", "差异化", "数字素养"], objective: "为不同语言水平设计合作角色，并按学习目标选择技术工具。", question: "技术和合作，什么时候真正提供了学习支持？" },
  { id: 13, title: "学习环境与课堂管理", hours: 2, group: 3, concepts: ["规则与常规", "积极关系", "自我管理"], objective: "理解课堂规则、预防与沟通如何服务学习与自我管理。", question: "好的课堂规则，应该帮助学生做到什么？" },
  { id: 14, title: "促进学习与评定学习的评价", hours: 2, group: 3, concepts: ["形成性评价", "信度与效度", "量规"], objective: "为语言任务制定简短量规，检查评价的一致性与潜在偏差。", question: "一个分数，能告诉我们学生理解了什么吗？" },
  { id: 15, title: "综合回顾与课程总结", hours: 2, group: 3, concepts: ["理论整合", "情境化判断", "方案修订"], objective: "比较理论的解释范围，整合课程概念并修订语言学习或教学方案。", question: "怎样用一套有依据的解释，把这门课连接起来？" },
];
export type Intervention = { id: number; title: string; unitId?: number; week?: number; focus: string; ready: boolean };
export const INTERVENTIONS: Intervention[] = [
  { id: 1, title: "从即时表现到可用知识", unitId: 6, week: 7, focus: "注意 · 认知负荷 · 意义编码 · 提取练习", ready: true },
  { id: 2, title: "从初始判断到有依据的方案", unitId: 10, week: 10, focus: "问题表征 · 批判思考 · 创造性 · 迁移", ready: true },
  { id: 3, title: "第三次教学干预", focus: "待选定讲义后确定任务与教学周", ready: false },
  { id: 4, title: "第四次教学干预", focus: "待选定讲义后确定任务与教学周", ready: false },
  { id: 5, title: "第五次教学干预", focus: "待选定讲义后确定任务与教学周", ready: false },
];
export const ACTIVE_UNIT_IDS = INTERVENTIONS.filter((item) => item.ready && item.unitId !== undefined).map((item) => item.unitId!);
export function getInterventionForUnit(id: number) { return INTERVENTIONS.find((item) => item.unitId === id); }
export type Task = {
  unitId: number; id: string; title: string; caseText: string; objective: string;
  prompts: Record<Stage, string>; hints: [string, string, string];
  concepts: { term: string; text: string }[]; criteria: string[]; source: string;
};
export const TASKS: Record<number, Task> = {
  6: {
    unitId: 6, id: "memory-vocabulary", title: "干预一：为什么学过的知识用不出来？",
    caseText: "一名学生反复抄写外语单词，周五能辨认词表并选出正确中文释义，周一在对话和新文章中却难以提取或使用。请先分析这段共同案例。进入修订阶段后，也可以选择自己最近一次‘学习时或即时测试成功，后来却用不出来’的经历；不必透露真实姓名、具体成绩或敏感信息。",
    objective: "重建学习经历，用注意、认知负荷、意义编码和提取练习四个概念分析具体证据，提出可检验的学习改进。",
    prompts: {
      initial: "先独立写出：①实际观察到什么？②你的一种解释是什么？③还需要什么观察或测试，才能将它与另一种解释区分？初答提交后才开放概念与 AI 支持。",
      revision: "分析共同案例或一段去标识的自身经历。先描述学了什么、实际怎样学习、什么即时表现让你认为学会了、什么后续任务暴露了困难。再分四项解释：①注意（attention）：注意了什么、忽略了什么，证据是什么？②认知负荷（cognitive load）：当时需要同时保持、比较或协调哪些信息，哪些需求来自任务本身、哪些来自呈现或方法？③意义编码（meaningful encoding）：新信息与哪些已有知识、图式或情境建立了联系？④提取练习（retrieval practice）：失败前何时尝试过不看答案的提取？最后写出替代解释、所需证据和一项可检查的改进；明确‘我改变了什么，哪条证据或追问促使我改变’。未发生或不确定之处如实写明，不补造经历。",
      transfer: "独立新情境：小周看语法例句时能理解规则，几天后独立写一封新的邮件时却用不出来。请区分观察与推断，选用相关概念解释，提出至少一种替代解释，并设计可以区分解释的检查。说明原案例的哪些原则能用、哪些需要调整。本阶段不提供 AI 或概念提示。",
      reflection: "用自己的话回答：我最初的解释是什么？现在修改了哪一处、依据是什么？哪个 AI 追问或教师提示有帮助，哪一点我没有采纳及原因？我仍不确定什么，下一次会用什么表现检查是否学会？使用对话次数不代表理解程度。",
    },
    hints: [
      "先重建‘学习做法—即时表现—后续表现’。哪一项是观察，哪一项只是可能原因？如果用自身经历，去掉识别个人的信息。",
      "按四个概念检查：注意到的特征；同时需要处理的信息；与已有知识建立的联系；不看答案提取的时机。‘很难’不是负荷证据，‘看着熟悉’不等于独立提取。",
      "部分框架：我当时注意____而可能忽略____，证据是____；需要同时处理____；新信息联系了____；不看答案的提取发生在____。一种解释是____，另一种是____；我将比较____来检查。请自行完成，不把框架当成答案。",
    ],
    concepts: [
      { term: "注意 attention", text: "指出学习时实际关注和可能忽略的特征，并用具体细节支持判断，不能从结果反推唯一原因。" },
      { term: "认知负荷 cognitive load", text: "描述同时保持、比较或协调的信息；区分任务必要需求与呈现、环境、方法带来的需求。不以‘困难’或能力标签替代证据。" },
      { term: "意义编码 meaningful encoding", text: "分析新信息如何与已有知识、图式、语言经验或情境建立联系；说明具体联系，不只报告重复次数。" },
      { term: "提取练习 retrieval practice", text: "识别学习者何时在不看答案的条件下尝试生成或使用知识；区分再认、即时表现、延迟提取和新情境应用。" },
    ],
    criteria: ["重建学习做法、即时表现与后续表现", "用具体证据分析四个要求的概念，未知之处明确标记", "区分观察、原因推断及替代解释", "改进包含可检查的学习证据", "说明修订了什么及修订理由"],
    source: "依据教师提供的《Week_7_讲义》：Cognitive Learning, Memory, and Knowledge，开场诊断与自我反思写作。对应课程单元 6、教学周 7、干预 1；网页问题、提示和迁移案例为教学改编，须由教师审核，不声称为教材原文。",
  },
  10: {
    unitId: 10, id: "problem-solving-transfer", title: "干预二：从第一判断到有依据的解决方案",
    caseText: "一名学生向海外教授发邮件：‘Send me the document before Friday.’ 语法成立、请求也被理解，但教授觉得语气生硬。学生立即判断‘我的英语不好’。请分析这一情境，而不是只把句子改得更礼貌；还要考虑沟通目标、双方关系、已有约定和情境信息。",
    objective: "区分观察与初始判断，重新表征问题，评价主张、证据和假设，先生成多个方案再按条件选择，并说明迁移时的调整。",
    prompts: {
      initial: "独立写出：①可观察的问题是什么？②两种不同的问题表征是什么？③你的第一方案及其假设是什么？④还缺少哪些信息才能选择方案？暂不使用 AI 改写邮件。",
      revision: "依次完成：①初始判断：原来的主张、假设或熟悉做法是什么？②批判性评价：有什么证据支持它、遗漏了什么、还有什么解释？③创造性生成：暂缓评价，先自行提出至少两个不同方案（不只换一个礼貌词）。④选择与修订：根据目标、受众、关系、信息准确性与现实约束比较方案，选择并修订一个，说明适切性、相对新颖之处和需要的效果证据。最后标明改变了什么、哪条证据或追问促使改变。也可使用去标识的真实语言、翻译或跨文化问题，但保持同一分析结构。",
      transfer: "独立新情境：你负责给国际学生小组发送双语活动通知。对方准确理解了时间，却因你未说明报名截止、所需准备和沟通渠道而迟迟没有行动。请重新表征问题，检验你的第一判断，生成并比较至少两个方案。说明从原案例迁移了什么原则，哪些地方因任务、媒介或关系变化需要调整。不使用 AI，不以抄写原邮件方案替代分析。",
      reflection: "总结五个环节：初始判断、证据评价、方案生成、选择与修订、迁移。哪些判断改变了，依据是什么？哪条 AI 追问你采纳或没有采纳，为什么？哪些原则可以用于另一种语言、关系或任务，哪些必须适配？请描述可见的推理过程，不只报告最终是否成功。",
    },
    hints: [
      "把‘教授觉得生硬’与‘英语不好’分开。前者是观察，后者是待检验判断。目标、关系或既有约定不同，问题表征会怎样变化？",
      "用‘主张—证据—假设—替代解释’检查第一判断。生成阶段先提出多个方案，之后再用适切性、准确性、可行性和相对新颖性筛选。",
      "部分框架：观察____；两种表征____/____；支持判断的证据____，缺少____；方案 A____、B____；依据____我选____；在新情境中保留原则____但调整____。不要直接填入 AI 给出的完整邮件。",
    ],
    concepts: [
      { term: "问题表征 problem representation", text: "界定当前状态、目标、相关信息与限制。不同表征引导不同方案；不要在缺少情境信息时把问题归为语言能力不足。" },
      { term: "算法与启发式 algorithms / heuristics", text: "区分在条件明确时可按步骤检查的程序与不保证成功的搜索方法；语法检查与整体沟通方案可能需要不同策略。" },
      { term: "批判性思考 critical thinking", text: "评价主张、证据、假设和替代解释。结论强度与证据相称，不把自信表达或习惯反对当作良好推理。" },
      { term: "发散与聚合 divergent / convergent thinking", text: "先生成不同可能，再根据目标和限制比较、选择。创造性不仅是新奇，还要求适切、有用；暂缓评价不等于取消标准。" },
      { term: "监控与固着 monitoring / fixation", text: "检查方案是否接近目标。若第一种熟悉做法无效，可以返回问题表征，而不是只重复或润色它。" },
      { term: "迁移 transfer", text: "识别新旧情境中的深层关系，提取相关原则并按新条件调整；一个受到支持的成功答案不自动证明独立迁移。" },
    ],
    criteria: ["区分观察、判断、假设与两种问题表征", "评价证据并考虑替代解释", "先自行生成至少两个不同方案", "依据目标和限制选择、修订并说明理由", "说明可迁移的原则及必要的情境调整"],
    source: "依据教师提供的《Week_10_讲义》：Problem Solving, Critical Thinking, Creativity, and Transfer，开场沟通案例与五环节自我反思写作。对应课程单元 10、教学周 10、干预 2；网页任务、提示和迁移案例为教学改编，须由教师审核，不声称为教材原文。",
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
