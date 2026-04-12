# Product Definition Output

> 标注：Idea 2 / 第二个方案

## 1. Product Summary
- 产品名称（暂定）：FairSign AI
- 备选名称：ClauseGuard、LegalLens
- 一句话产品描述：一个面向合同签署场景的 AI 合同审查与谈判插件，不只指出条款风险，还会结合用户身份解释为什么不利、可能发生什么、以及该如何反击。
- 核心问题：普通用户和中小企业在面对雇佣合同、租房合同、服务协议等文件时，通常能被动看到“有风险”，但不知道风险对自己意味着什么，也不知道如何提出更公平的修改意见。
- 产品目标：把“合同风险提醒”升级为“身份感知的谈判助手”，让用户在签字前获得可理解、可行动、可复制的建议。

## 2. 为什么这个想法值得做
- 这个想法比纯合同摘要工具更有产品感，因为它直接嵌入签约动作前的决策时刻。
- 它的交互性很强，评委能在 demo 中立刻看到“选身份 → 高亮风险 → 压力测试 → 一键改写”的闭环。
- 它天然适合 Access to Justice 叙事，因为很多弱势群体不是没有合同，而是看不懂合同、也不知道怎么反驳。
- 它兼具商业化路径和社会价值路径：
  - 商业化路径：合同谈判 copilot
  - 社会价值路径：租房/劳动法场景下的普惠法律保护工具
- 相比很多“AI legal assistant”泛化叙事，这个想法的用户场景更具体、演示更直观、价值更容易被非法律背景评委理解。

## 3. Target Users
- 结合比赛提供的用户画像，这个 idea 最相关的用户群有：
  - End consumers：租客、求职者、自由职业者、低收入劳动者、独立开发者
  - Businesses（尤其 SMBs）：小企业主、初创公司、个体经营者，在签服务合同、雇佣协议、供应商合同时使用
  - Law Firms：为个人或中小企业服务的 solo / small firm，可把它作为 intake 或 first-pass review 工具
  - In-house counsel：中小企业内部法务或 HR/ops 团队，用来做合同初筛
  - Legal support：paralegal、legal aid clinic staff、community legal workers

### Persona Prioritization for Hackathon
- Primary Persona：租客 / 劳动者 / 独立承包人等普通合同签署者
  - JTBD：在签合同前快速知道哪些条款会真实伤害自己，以及应该如何回应
  - Top Pain Points：
    - 看不懂法律语言，不知道条款后果
    - 不知道行业常见做法，缺少谈判底气
    - 想反驳但不会写，害怕“提要求显得不专业”
  - Desired Gains：
    - 把专业条款翻译成人话
    - 看到最坏情景和真实后果
    - 一键获得可发送的 counter-offer 文本
  - Product Fit：这是最适合 Access to Justice 叙事的主用户，也是 demo 最容易打动评委的一类人

- Secondary Persona：小企业 / 独立开发者 / freelancer
  - JTBD：在签服务、外包、保密、交付类合同时快速识别不对等条款，争取更公平的责任分配
  - Top Pain Points：
    - 经常为了拿项目被迫接受不平等条款
    - 不确定市场标准，不知道什么能谈
    - 没预算请律师逐条 review
  - Desired Gains：
    - 知道哪些条款超出行业常规
    - 快速生成“弱化风险 / 互惠对等 / 完全删除”的替代文本
    - 在不升级成本的情况下提升谈判质量
  - Product Fit：商业化潜力强，适合作为未来付费用户群

- Tertiary Persona：法律援助组织 / 小型律所 / legal support
  - JTBD：快速筛查大量合同，优先识别需要人工介入的高风险条款
  - Top Pain Points：
    - 人手有限，无法为每份合同提供完整人工审查
    - 很多来访者无法清楚描述自己的问题
    - 需要有证据和解释的输出，而不只是颜色高亮
  - Desired Gains：
    - 用 AI 做 first-pass triage
    - 用统一格式输出风险说明和建议
    - 把有限律师时间留给最复杂案件
  - Product Fit：非常符合 hackathon 的社会影响叙事，也有合作落地空间

### 不建议当前主打的用户
- Government lawyers and judicial employees：与签约前合同谈判插件的核心场景不匹配
- 大型企业法务全栈采购/合规团队：需求复杂，规则范围大，不适合 hackathon MVP

## 4. Problem Statement
- 当前大多数 AI 合同工具止步于“标风险”和“做摘要”，这对非专业用户不够。
- 用户真正缺的是三层能力：
  - 语义理解：这句话到底是什么意思
  - 结果理解：最坏会发生什么
  - 行动建议：我现在该怎么改、怎么谈
- 尤其在劳动合同、租房合同、独立承包合同中，弱势一方通常没有律师辅助，也缺少谈判语言和基准信息。
- 这个产品的价值在于把条款分析从被动阅读升级为主动决策支持。

## 5. Product Goals
### 用户侧目标
- 让用户在签署前理解合同对自己的实际影响
- 让用户知道哪些条款不公平、为什么不公平、是否偏离常见做法
- 让用户直接拿到可执行的修改建议或谈判话术

### 业务侧目标
- 在 demo 中体现“强交互 + 强反馈 + 强社会意义”
- 建立一个区别于普通 review bot 的产品定位：negotiation assistant
- 为后续商业化保留双路径：B2C 普惠版 + SMB / legal aid 专业版

## 6. Core Use Cases
### Use Case A: 租客签租房合同前快速排雷
- 场景描述：用户在 PDF 或网页中打开租房合同
- 用户目标：知道押金、维修责任、解约条款、驱逐条款等是否对自己过于不利
- 触发条件：用户选择身份“租客”
- 成功结果：系统高亮风险，解释后果，并给出可复制的协商文本

### Use Case B: 求职者签雇佣合同时审查限制性条款
- 场景描述：用户打开 offer letter 或 employment agreement
- 用户目标：看懂 non-compete、IP assignment、termination、arbitration 等条款
- 触发条件：用户选择身份“雇员”
- 成功结果：系统结合身份说明风险，并提供反建议

### Use Case C: 独立开发者签服务协议前争取对等条款
- 场景描述：freelancer 或小团队与客户签软件开发协议
- 用户目标：避免承担无限责任、单方终止、过度 indemnity 等风险
- 触发条件：用户选择身份“个人开发者”或“小企业”
- 成功结果：系统输出压力测试结果、行业基准和对等修改文案

### Use Case D: 法律援助机构做初筛
- 场景描述：legal aid clinic 收到大量租房/劳动合同咨询
- 用户目标：快速区分哪些合同值得优先升级到人工 review
- 触发条件：批量导入合同或在插件中逐份查看
- 成功结果：系统给出风险级别、受影响用户类型和建议动作

## 7. Feature Scope
### In Scope
- 插件式入口：优先设定为 Chrome 插件或文档侧边栏插件
- 身份预设（Identity Profiling）
- 合同扫描与风险高亮
- 条款解释：把法律语言翻译成人话
- 压力测试（What If Simulator）
- 行业基准对比（Benchmarking）
- 一键反击建议（Counter-offer Generator）
- 风险摘要与建议动作
- 基于合同类型的场景化模板：租房、雇佣、独立承包/服务协议优先

### Out of Scope
- 自动替代律师给出正式法律意见
- 覆盖所有合同类型和所有司法辖区
- 自动向对方发送谈判邮件
- 生成可直接用于诉讼的法律文件
- 复杂企业采购合同、跨境 MSA、重度合规合同的完整审查

## 8. 这个想法最强的地方
- 从 risk spotting 升级到 negotiation assistance
- 从抽象风险分数升级到具体生活后果
- 从统一答案升级到身份感知的差异化建议
- 从“我看懂了”进一步走到“我可以行动了”

这四点非常适合做 demo，也最容易形成产品差异化。

## 9. 我对你们的核心建议
### 建议 1：Hackathon 版本优先聚焦一个社会价值场景
- 如果你们想兼顾产品力和评委好感，我建议优先聚焦：
  - 租房合同
  - 雇佣/劳动合同
- 这两个场景最适合 A2J 叙事，也最容易解释“弱势群体为什么需要这个工具”

### 建议 2：不要试图一开始覆盖所有合同类型
- 合同类型太多会让规则、身份、benchmark 全部发散
- MVP 最好只选 2 到 3 类合同
- 例如：
  - Employment agreement
  - Residential lease
  - Independent contractor agreement

### 建议 3：把“身份视角”做成主线，而不是附属功能
- 你们的真正差异点不是“AI 会审条款”
- 而是“AI 知道你是谁，所以能告诉你这条款为什么对你不利”
- pitch 时要反复强调：
  - same clause, different impact, different advice

### 建议 4：Benchmarking 要谨慎表述
- “90% 合同都没有这个条款”这种说法很有冲击力，但也最容易被质疑数据来源
- MVP 可以先改成更稳妥的表达：
  - common / aggressive / unusual
  - often negotiable / typically one-sided / requires review
- 如果没有真实数据支撑，不建议在比赛中做非常具体的统计承诺

### 建议 5：Counter-offer Generator 是最关键的 wow point
- 很多产品都能高亮和解释
- 真正让用户觉得“这东西有用”的，是能直接给出谈判文本
- 建议每个高风险条款至少提供 3 个选项：
  - 弱化风险
  - 完全删除
  - 互惠对等

### 建议 6：压力测试要做得具体、可感知、非抽象
- 不要只说“风险高”
- 要说：
  - 如果你晚交 7 天会怎样
  - 如果你生病没法履约会怎样
  - 如果房东单方解释违约会怎样
- 这种“生活化冲击”非常利于 demo

## 10. 推荐的产品定位
- 定位一句话：
  - An identity-aware AI contract review and negotiation assistant for people who sign before they fully understand.

### 如果偏商业化
- AI negotiation copilot for employment, lease, and independent contractor agreements

### 如果偏社会价值
- A fair-contract assistant that helps workers and tenants understand, challenge, and negotiate exploitative terms before signing

### 我的推荐
- hackathon 版本优先走“公平 + 行动能力”路线，比纯商业效率叙事更容易形成记忆点

## 11. MVP Definition
### MVP 必须包含的能力
- 用户打开一份合同
- 用户先选择身份
- 系统识别高风险条款并高亮
- 点击条款后，系统展示：
  - 人话解释
  - 为什么对该身份不利
  - 一个最坏情景模拟
  - 一个 counter-offer 选项
- 支持至少 2 类合同场景
- 输出整体风险摘要

### 为什么这些是 MVP
- 这些能力已经足够形成完整体验闭环：身份选择 → 合同扫描 → 风险解释 → 情景反馈 → 反建议
- 如果缺少身份视角，产品会退化成普通合同 review 工具
- 如果缺少 counter-offer，产品很难体现“谈判助手”的差异价值
- 如果缺少 pressure test，交互冲击力会弱很多

## 12. Prioritization
### MVP
- Identity profiling
- Clause highlighting
- Plain-language explanation
- What-if simulator
- Counter-offer generator
- 2 to 3 contract types

### P1
- Benchmarking
- 多身份切换对比
- 邮件式谈判建议
- 更细颗粒的条款分类
- 多州法提示

### P2
- Word / Google Docs 插件
- 批量审查
- 与 legal aid / SMB workflow 集成
- 用户历史谈判偏好学习
- 多语言合同支持

### 优先级依据
- 是否能在 demo 中形成强反馈
- 是否直接服务主用户的关键决策
- 是否能清晰体现身份感知差异
- 是否依赖大量外部数据与复杂规则

## 13. User Stories
- 作为租客，我希望在签租房合同前知道哪些条款会让我承担不合理风险，以便我能要求修改。
  - Priority：MVP
  - Acceptance Criteria：系统能高亮不利条款，并说明最坏情况和可复制修改建议

- 作为求职者，我希望系统根据我是雇员而不是雇主来解释 non-compete 条款，以便我理解它对我职业自由的影响。
  - Priority：MVP
  - Acceptance Criteria：同一条款在不同身份下显示不同解释和建议

- 作为独立开发者，我希望系统告诉我责任条款是否失衡，并生成更对等的版本，以便我更有底气谈判。
  - Priority：MVP
  - Acceptance Criteria：系统可生成“弱化风险 / 完全删除 / 互惠对等”三类建议

- 作为法律援助工作人员，我希望快速看到合同中最值得人工介入的条款，以便把时间优先留给高风险来访者。
  - Priority：P1
  - Acceptance Criteria：系统能输出风险摘要和优先关注条款列表

## 14. PRD
### Requirement: 身份预设与上下文个性化
- Background：同一条款对不同身份的影响差异巨大
- Goal：让系统在分析前就理解用户所处位置和利益方向
- Description：用户在使用插件时先选择身份，如雇员/雇主、租客/房东、个人开发者/大型企业
- User Story Mapping：支撑定制化解释和建议
- Functional Details：
  - 身份选择
  - 场景记忆
  - 身份相关的风险权重调整
- Business Rules：
  - 同一条款在不同身份下可输出不同结果
  - 身份可切换查看对比
- Success Criteria：用户感知到系统建议与自己处境高度相关
- Edge Considerations：用户身份混合、多方代理签署、角色不明确

### Requirement: 条款高亮与人话解释
- Background：非法律用户首先需要理解条款含义
- Goal：把复杂法律语言翻译为用户能立即理解的解释
- Description：系统扫描合同，对重点条款进行颜色标记，并给出 plain-language explanation
- User Story Mapping：支撑风险识别和后续互动
- Functional Details：
  - 条款识别
  - 风险分级
  - 人话解释
  - 关键原因说明
- Business Rules：
  - 输出必须避免无依据的绝对法律结论
  - 解释应强调“风险”“影响”“建议”，而非替代律师定性
- Success Criteria：用户读完解释后能复述条款对自己的影响
- Edge Considerations：扫描质量差、合同格式混乱、条款跨段落

### Requirement: 压力测试模拟器
- Background：抽象风险提示难以驱动用户行动
- Goal：通过场景模拟让用户感知条款后果
- Description：用户点击某条款后，系统生成一个与该身份相关的最坏情境
- User Story Mapping：强化风险理解和谈判动力
- Functional Details：
  - 选中条款
  - 生成 what-if scenario
  - 展示潜在损失或后果
- Business Rules：
  - 模拟内容应与条款文字相关
  - 不应使用过度夸张且无法解释的场景
- Success Criteria：用户能说清该条款在现实中可能如何伤害自己
- Edge Considerations：后果依赖司法辖区、金额无法精确计算

### Requirement: 行业基准与谈判建议
- Background：用户不懂“什么叫正常”，所以不敢谈
- Goal：给用户谈判锚点和可执行文本
- Description：系统对高风险条款给出“常见 / 激进 / 值得谈判”的判断，并提供替代文本
- User Story Mapping：支撑从理解到行动的转化
- Functional Details：
  - benchmark 标签
  - 三类 counter-offer 选项
  - 可复制文本
- Business Rules：
  - benchmark 的表述必须与数据能力匹配
  - 替代文本应根据身份和合同类型变化
- Success Criteria：用户能直接复制或改写建议用于沟通
- Edge Considerations：数据依据不足、对方模板固定、 jurisdiction 差异

## 15. 风险与 Open Questions
### 主要风险
- 不同州法和合同类型差异大，规则边界容易失控
- Benchmarking 最容易被追问“数据从哪来”
- 若表达过度确定，可能触发法律责任和可信度问题
- 插件环境中的合同格式复杂，技术实现会受网页结构和 PDF 质量影响

### Open Questions
- hackathon 版本优先做 Chrome 插件、网页侧栏，还是文档上传式 demo？
- 是优先做租房 + 劳动法，还是做更偏商业合同的 freelancer 场景？
- Benchmarking 是否有真实样本数据支持，还是先采用标签式表达？
- Counter-offer 输出是偏正式法律文本，还是更适合用户直接发消息的自然语言？

## 16. 我对你们的具体建议
- 如果你们追求比赛效果，我建议把这个 idea 讲成“公平签约助手”，而不只是“合同审查插件”
- 主叙事最好锁定一个核心用户：
  - workers and tenants who sign contracts without legal support
- 再补一句 secondary market：
  - freelancers and small businesses can use the same workflow to negotiate more balanced contracts
- demo 里一定要展示身份切换，否则差异化会弱
- 最重要的一个交互瞬间应该是：
  - 点击红色条款
  - 弹出后果解释
  - 一键生成反建议
- 如果资源有限，benchmarking 可以弱化，counter-offer 和 pressure test 必须保留

## 17. Recommended Demo Narrative
- 用户打开一份租房合同或雇佣合同
- 插件右侧弹出，用户选择“我是租客”或“我是雇员”
- 系统自动扫描合同，并用红黄绿高亮条款
- 用户点击一个红色条款
- 系统显示：
  - 这句话是什么意思
  - 为什么它对该身份不利
  - 如果发生最坏情况会怎样
  - 一段可复制的修改建议
- 用户点击“互惠对等”或“弱化风险”
- 系统生成可直接发送给对方的 counter-offer 文本

## 18. Handoff Summary
- 产品核心目标：让没有律师陪伴的合同签署者，在签字前理解风险、看到后果、获得谈判建议
- MVP 范围：身份选择、条款高亮、人话解释、压力测试、反建议生成、2 到 3 类合同支持
- 最关键的用户任务：用户看到一条不利条款后，能立即理解并采取行动
- 明确不做：不替代正式法律意见、不覆盖所有合同类型、不承诺完整司法辖区适配
- 给 UX Agent 的重点：围绕“身份感知、反馈冲击力、行动按钮”设计体验
- 给开发 Agent 的重点：围绕“身份模型、条款分类、风险解释、模拟生成、改写输出”组织系统能力
