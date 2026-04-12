# Cap Table Audit Copilot

> 标注：Idea 1 / 第一个方案

## 1. Product Summary

- 产品名称（暂定）：Cap Table Audit Copilot
- 一句话产品描述：一个面向融资与法务场景的 AI 股权审计助手，自动从法律文件中提取股权事件，重建理论 cap table，并与公司现有 cap table 做一致性核对。
- 核心问题：初创公司与律师在融资、尽调、二级交易或内部治理中，经常面临 cap table 与交易文件不一致、历史融资事件遗漏、SAFE/可转债转换逻辑不清、期权池审批链条缺失等问题，人工核查成本高、风险大、极易漏错。
- 产品目标：把“读文件 + 重建股权历史 + 对账 + 找异常 + 出证据报告”变成一个半自动、可追溯、可审计的工作流。

## 2. 为什么这个想法值得做

- 这个方向很适合法律科技 hackathon，因为它不是泛泛的“文档问答”，而是直接切入一个高价值、强专业壁垒、痛点明确的法律/融资流程。
- 你们的亮点不是单纯 OCR 或提取，而是“事件驱动的股权重建 + 与 cap table 的交叉校验”。这个闭环比很多只做文件摘要的方案更强。
- 用户价值足够清晰：减少人工 review 时间、降低遗漏风险、快速定位问题、输出可给律师/财务继续使用的结构化结果。
- 这个题目天然适合展示 AI 的强项：跨文档关联、条款归纳、证据定位、异常检测、结构化输出。
- 如果 demo 做得好，评委会比较容易理解价值，因为“同一家公司不同材料说法不一致”是直观且高风险的问题。

## 3. Target Users

- 结合比赛给出的用户画像，这个方向最相关的潜在用户群包括：
  - Law Firms：solo/small firm、mid-size firm、large firm 中做融资、尽调、venture practice 的律师团队
  - In-house counsel：中大型公司法务团队，尤其是负责融资、投资、公司治理和历史股权管理的人
  - Legal support：paralegal、legal ops、finance ops、corporate secretary、内部合规支持人员
  - End consumers（企业端而非个人消费者）：startup founders、CFO、controller、finance lead，在融资或尽调前自行整理 cap table
- 在这些画像里，你们最应该聚焦的 beachhead user 是：
  - 核心用户 1：Law firm 中负责 startup financing / diligence 的律师与 paralegal
  - 核心用户 2：创业公司或成长型公司内部的 in-house counsel / finance ops
  - 核心用户 3：需要在融资前自查材料的 founder / CFO

### Persona Prioritization for Hackathon

- Primary Persona：律所融资律师 / paralegal
  - JTBD：快速核对 transaction documents 与 cap table 是否一致，并定位最值得优先复核的冲突点
  - Top Pain Points：
    - 文件数量多、版本混乱、人工交叉核对耗时
    - SAFE / note / option / board consent 之间关系复杂，容易漏项
    - 需要把结论回溯到具体文件和条款，方便向客户追问
  - Desired Gains：
    - 更快完成第一轮 review
    - 更早发现高风险 inconsistency
    - 直接生成可用于内部协作的结构化问题清单
  - Product Fit：这是最强产品契合用户，因为他们最频繁、最痛地面对“文件多但结论要快且要准”的问题
- Secondary Persona：公司内部法务 / finance ops
  - JTBD：在正式融资、尽调或并购前，验证公司 cap table 是否完整一致，提前补齐问题
  - Top Pain Points：
    - 历史融资文件散落在不同邮箱、数据室、Excel 中
    - 现有 cap table 往往是某个版本不断修改，不一定和原始法律文件严格一致
    - 很难判断哪些问题是“真的缺文件”，哪些只是“没被记录进表”
  - Desired Gains：
    - 在外部律师进入前先做内部自检
    - 知道哪些文件缺失、哪些转换未体现
    - 降低正式交易时被动挨打的风险
  - Product Fit：这个群体很适合产品后续商业化，因为他们愿意为“减少交易摩擦”和“提升材料可信度”买单
- Tertiary Persona：Founder / CFO / controller
  - JTBD：在下一轮融资前快速判断自己的股权表是否可信，避免在投资人尽调时暴露问题
  - Top Pain Points：
    - 不具备律师级别的条款分析能力
    - 只知道 cap table 当前版本，不知道历史逻辑是否闭环
    - 害怕融资时被发现 SAFE、期权池、批准链存在漏洞
  - Desired Gains：
    - 用更低成本做 pre-diligence
    - 提前修补材料与 cap table 的不一致
    - 在与律师合作前先掌握风险地图
  - Product Fit：适合后续扩张市场，但在 hackathon demo 中应作为补充受益者，而不是第一叙事中心

### 不建议当前主打的用户

- Government lawyers and judicial employees：与 cap table / startup financing 的核心场景不匹配
- 泛化的 end consumers（个人消费者）：问题不够高频，也缺乏明确付费和使用场景

### 用户典型场景

- 融资前整理历史股权结构，确认现在 cap table 是否可信
- 核对 transaction documents 与 cap table 的数据是否一致，并快速定位冲突项
- 尽调阶段快速核对 SAFE、可转债、期权池和董事会批准记录
- 二级交易或并购前，对历史股权事件进行审计与补缺
- 律所或法务团队接收一堆 PDF / Word / Excel 后，需要快速形成初步风险清单

### 用户主要痛点

- 文件来源多、格式杂、版本乱
- 交易文件和 cap table 常常相互矛盾
- SAFE / convertible note 的转换规则复杂
- 期权授予、董事会决议、期权池扩充可能缺文件或缺批准链
- 人工 cross-check 非常慢，而且无法稳定追溯“结论来自哪一页哪一条”

### 比赛语境下的用户定义建议

- 如果比赛要求你们清晰回答“identify your user and key problem”，我建议你们在台上只主讲一个主 persona：
  - “Startup financing lawyers and legal support teams who need to verify whether a company’s cap table is actually supported by its legal documents.”
- 然后再补一句 secondary persona：
  - “The same workflow is also valuable for in-house legal and finance teams preparing for diligence.”
- 这样既满足比赛的用户画像框架，又不会让你们的故事显得过于发散

## 4. Problem Statement

- 当前的股权核查工作主要靠律师或财务手工阅读文件、做 Excel 对账、靠经验判断缺失项。
- 现有方式的问题不只是慢，而是“难以完整、难以追溯、难以解释”：
  - 难以完整：跨文件事件容易遗漏
  - 难以追溯：异常发现后，回不到精确证据
  - 难以解释：为什么 cap table 不对，往往只能靠人工口头判断
- 这个产品的价值在于把“股权事件”抽成标准化对象，并基于时间顺序重放，得到可验证的理论 cap table，再与现有数据进行系统比对。

## 5. Product Goals

### 用户侧目标

- 让用户在短时间内知道 cap table 是否可信
- 让用户快速发现不一致、遗漏转换、缺失批准、异常稀释
- 让每一个结论都能回溯到原始文件和具体条款

### 业务侧目标

- 在 demo 中建立“比纯文档提取更深一层”的产品定位
- 展示该产品未来可扩展到融资尽调自动化、法律审计工作台、交易前检查工具

## 6. Core Use Cases

### Use Case A: 融资尽调前的快速核查

- 场景描述：律师收到 SAFE、股权购买协议、期权授予、董事会决议、公司 cap table
- 用户目标：在第一轮 review 中找出最可能出问题的股权事项
- 触发条件：上传公司全部历史股权相关材料
- 成功结果：系统输出理论 cap table、异常列表、证据定位

### Use Case B: 发现 cap table 是否漏记转换

- 场景描述：公司提供的 cap table 没体现某些 SAFE 或 note 已转换
- 用户目标：确认缺失的工具、转换时点、影响股份数量
- 触发条件：系统从 SAFE / note 中识别到转换条款，并在某轮融资中找到触发条件
- 成功结果：报告指出“应转换但未反映”的工具，并说明影响

### Use Case C: 期权池与董事会批准链核查

- 场景描述：cap table 里有期权池或期权授予，但 supporting documents 不完整
- 用户目标：找出缺少 board consent 或 grant evidence 的部分
- 触发条件：期权事件存在，但找不到相应批准或授权文件
- 成功结果：系统标记“记录存在，但批准依据缺失”

### Use Case D: 重建 fully diluted cap table

- 场景描述：历史文件很多、结构复杂，现有 cap table 可信度不高
- 用户目标：基于法律文件从 0 重建 fully diluted 表
- 触发条件：系统抽取到足够的股权事件
- 成功结果：输出理论 cap table、时间线、稀释结果和差异说明

## 7. Feature Scope

### In Scope

- 文档导入：支持 PDF / Excel，优先支持 SAFE、Stock Purchase Agreement、Option Grant、Board Consent、Convertible Note、公司 cap table
- 股权事件提取：提取投资金额、股份数量、证券类型、估值/折扣/上限、转换条款、期权池变化、董事会批准等
- 事件标准化：把不同文件映射为统一事件模型
- 事件时间线：按时间顺序排列所有股权事件
- 股权重建：从 founder 初始股份开始，逐步重放事件，得到理论 cap table
- 对账校验：与公司提供的 cap table 做股东、股数、持股比例、fully diluted 口径的对比
- 一致性核对：确保 transaction documents 与 cap table 的关键数据一致，并高亮冲突位置供律师快速复核
- 异常检测：识别缺失转换、缺失审批、融资轮次缺失、股数不平、比例不平
- 审计报告：输出结构化问题清单，并标注证据来源（文件 + 条款/页面）

### Out of Scope

- 自动生成最终法律意见书
- 覆盖所有复杂证券的完整法律解释
- 自动替律师决定以哪个版本为准，并直接修改底稿或生成可直接签署的法律文书
- 多司法辖区、所有州法差异的精细规则处理
- 二级交易、员工行权税务、409A 全栈分析

## 8. 你们当前想法里最强的部分

- 不是做“文件总结”，而是做“reconciliation engine”
- 不只是“抽取字段”，而是“从事件流推导应然结果”
- 不只是“发现错”，而是“给出证据和原因”
- 不只是“看 cap table”，而是“重建 fully diluted cap table”

这四点建议你们在 pitch 时反复强调，因为这会把产品从普通 legal AI assistant 拉高到 transaction intelligence / equity audit 的层级。

## 9. 我建议你们进一步收敛的方向

### 建议 1：先聚焦 Delaware C-Corp 的早期融资场景

- 不要一开始覆盖所有公司类型与复杂证券
- 最佳 demo 范围应聚焦“YC/VC 常见早期公司文档包”
- 这样规则边界更清晰，评委也更容易理解

### 建议 2：优先做“发现问题”而不是“给出绝对法律结论”

- hackathon 阶段最可信的定位是 audit copilot，而不是 legal decision maker
- 你们应该输出：
  - 发现了什么不一致
  - 为什么怀疑有问题
  - 证据在哪里
  - 还缺什么信息
- 这比直接宣称“法律上一定错误”更稳妥，也更专业

### 建议 3：把“证据可追溯性”做成核心卖点

- 每一条异常都应该能点开看到：
  - 文件名
  - 页码 / 条款
  - 提取出的关键字段
  - 系统为什么得出这个判断
- 如果你们 demo 里这一层做出来，会非常加分

### 建议 4：MVP 不要试图把所有转换数学都做满

- SAFE / note 转换逻辑非常容易爆炸
- MVP 可以先覆盖：
  - post-money SAFE
  - 常见 discount / valuation cap note
  - priced round 触发转换
- 更复杂的 MFN、pro rata side letter、multiple closing 等可以留到后续

### 建议 5：对“缺失信息”要单独建模

- 你们不只是找不一致，还要找“缺文档、缺链条、缺关键字段”
- 这在法务工作里非常有价值
- 比如：
  - 有期权池，但无 board consent
  - 有 SAFE，但无后续转换记录
  - 有融资轮文件，但 cap table 无对应发行

## 10. 建议的产品定位

- 定位一句话：
  - AI-powered cap table reconciliation and equity audit copilot for startup financings

### 更适合评委理解的价值表达

- “We reconstruct what the cap table should be from legal documents, then compare it against what the company says it is.”
- “We do not just summarize documents; we detect inconsistencies, missing conversions, and missing approvals with evidence.”

## 11. MVP Definition

### MVP 必须包含的能力

- 上传一组交易文件与 cap table
- 从 SAFE / SPA / Option Grant / Board Consent / Convertible Note 中提取标准化股权事件
- 生成按时间排序的事件时间线
- 从 founder 初始股份出发，重建理论 cap table
- 与公司 cap table 做基础对账
- 输出 3 类核心异常：
  - 数量不一致
  - 漏转换
  - 缺批准/缺 supporting document
- 每个异常都带证据来源

### 为什么这些是 MVP

- 这些能力已经形成完整闭环：文档输入 → 事件提取 → 重建 → 对比 → 风险输出
- 如果缺少“重建”，你们就会退化为普通 extraction 工具
- 如果缺少“对比”，就无法体现法律/融资核查的业务价值
- 如果缺少“证据”，报告就不具备可用性

## 12. Prioritization

### MVP

- SAFE / Note / SPA / Option Grant / Board Consent / cap table ingestion
- 事件标准化
- cap table 重建
- inconsistency detection
- evidence-linked audit report

### P1

- 更完整的 fully diluted 口径处理
- 多轮融资之间的自动关联
- 对 board approval chain 的更细颗粒检查
- 缺失字段的置信度提示与人工确认流程

### P2

- 支持更多证券类型与 side letters
- 生成 diligence checklist
- 与律所现有数据室或文档系统集成
- 输出可供律师二次编辑的 memo / closing checklist

### 优先级依据

- 是否直接支撑核心用户任务
- 是否构成产品闭环
- 是否能在 demo 中直观看到价值
- 是否会引入过多规则复杂度

## 13. User Stories

- 作为律所的初级律师，我希望上传一套融资文件后快速看到潜在股权异常，以便我先聚焦高风险问题。
  - Priority：MVP
  - Acceptance Criteria：系统输出异常列表，并给出对应文件与证据定位
- 作为公司法务，我希望系统根据 SAFE 和可转债自动判断是否应在某轮融资中转换，以便发现 cap table 是否漏记。
  - Priority：MVP
  - Acceptance Criteria：系统能标记应转换工具、触发依据和理论新增股份
- 作为 finance ops，我希望系统重建一份理论 fully diluted cap table，以便与现有版本对账。
  - Priority：MVP
  - Acceptance Criteria：系统输出股东、证券类别、股份数、持股比例和计算口径
- 作为尽调团队成员，我希望系统指出哪些期权池或授予缺少董事会批准记录，以便补齐 supporting documents。
  - Priority：MVP
  - Acceptance Criteria：系统能标记缺失批准链的记录并列出缺哪些文件
- 作为 founder，我希望知道当前 cap table 哪些地方最不可信，以便在正式融资前先修正问题。
  - Priority：P1
  - Acceptance Criteria：系统给出可信度摘要与待修复清单

## 14. PRD

### Requirement: 文档解析与标准化

- Background：股权信息分散在不同法律文件和表格中
- Goal：从不同格式的材料中提取统一的股权事件
- Description：系统解析 SAFE、SPA、Option Grant、Board Consent、Convertible Note 和 cap table，并映射为标准化事件
- User Story Mapping：支持上传、提取、核对、追溯
- Functional Details：
  - 识别文件类型
  - 提取关键字段
  - 输出结构化事件
  - 记录证据来源
- Business Rules：
  - 同一事件可有多个 supporting documents
  - 字段不完整时应标注缺失而不是强行猜测
- Success Criteria：用户可查看结构化事件及其证据
- Edge Considerations：扫描件质量差、日期缺失、版本冲突

### Requirement: 股权重建引擎

- Background：单看现成 cap table 无法知道它是否可信
- Goal：基于事件流推导理论 cap table
- Description：从 founder 初始股份起，按时间顺序应用发行、转换、期权池调整等事件
- User Story Mapping：支撑理论结果计算
- Functional Details：
  - founder 初始股设定
  - 轮次增发
  - 稀释计算
  - SAFE / note 转换
  - 期权池变化
- Business Rules：
  - 所有计算都应保留来源事件
  - 有歧义时输出假设说明
- Success Criteria：得到可解释的理论 cap table
- Edge Considerations：同日多事件、缺价格、缺 fully diluted 定义

### Requirement: 对账与异常检测

- Background：真正价值在于发现“不一致”和“遗漏”
- Goal：把 transaction documents、理论 cap table 与公司 cap table 做系统性比对，确保关键数据一致并输出可复核的冲突点
- Description：对比股东名单、股份数、持股比例、证券类别、fully diluted 口径，并高亮 transaction documents 与 cap table 之间的冲突位置
- User Story Mapping：支撑法律与融资核查
- Functional Details：
  - shareholder match
  - share count variance
  - ownership variance
  - transaction document vs. cap table conflict highlighting
  - missing instrument detection
  - missing conversion detection
  - missing approval detection
- Business Rules：
  - “无法判断”应与“不一致”分开
  - 所有异常必须能追溯证据
- Success Criteria：用户能快速理解异常性质、影响和依据，并直接定位到需要人工复核的冲突部分
- Edge Considerations：命名不一致、附件缺失、版本冲突

### Requirement: 审计报告输出

- Background：用户需要的是可交付结果，而不是原始抽取表
- Goal：输出一份可读、可审阅、可继续人工跟进的结构化报告
- Description：报告总结重建结果、异常、缺失项、证据来源和待确认问题
- User Story Mapping：支撑 review、汇报、补件和后续法律分析
- Functional Details：
  - executive summary
  - inconsistency list
  - missing information list
  - evidence table
  - open questions
- Business Rules：
  - 结论必须区分 confirmed / likely / missing information
- Success Criteria：律师或团队成员可直接用报告继续工作
- Edge Considerations：证据冲突、同一问题多份来源

## 15. 风险与 Open Questions

### 主要风险

- SAFE / note 的条款变化很多，规则稍微扩张就可能复杂度失控
- 文件质量可能很差，抽取的稳定性会成为 demo 风险
- fully diluted 的定义在不同公司资料中口径不一致
- 如果结果给得过于“确定”，会有法律责任表述风险

### Open Questions

- MVP 是否只支持 Delaware startup 融资常见文档？
- founder 初始股份是由用户手动输入，还是也从文件中识别？
- 当条款信息缺失时，是采用“无法计算”还是“基于假设给出估算”？
- 最终报告主要服务律师，还是也服务 founder / finance 团队？

## 16. 我对你们的具体建议

- 把 demo 讲成三步，而不是十几个功能：
  - Step 1：AI reads legal financing documents
  - Step 2：AI reconstructs the cap table from events
  - Step 3：AI finds inconsistencies and missing items with evidence
- 把输出页面聚焦在三块：
  - 事件时间线
  - 理论 vs 公司 cap table 对比
  - 异常与证据列表
- 不要试图让系统在 hackathon 阶段覆盖全部复杂法律边界；明确说你们先做“high-confidence audit workflow”
- 尽量准备一组“故意埋了错误”的样例材料，这样 demo 才能强力展示价值
- 最终 pitch 不要只说提取准确率，而要说“we surface what humans are likely to miss”

## 17. Recommended Demo Narrative

- 输入：一组 SAFE、SPA、Option Grant、Board Consent、Convertible Note 和一份公司 cap table
- 系统先识别并抽取所有股权事件
- 系统按时间线重放事件，得到理论 fully diluted cap table
- 系统将理论结果与公司 cap table 对比
- 系统突出显示：
  - 某 SAFE 应在 priced round 转换但未计入
  - 某期权池扩充缺少 board consent
  - 某轮融资股份总数与 cap table 不匹配
- 最后系统生成一份带证据引用的审计报告

## 18. Handoff Summary

- 产品核心目标：把法律文件中的股权信息转化为可验证的事件流，并自动审计 cap table 的正确性与一致性
- MVP 范围：文档解析、股权事件提取、时间线重建、理论 cap table 计算、对账、异常检测、证据报告
- 最关键的用户任务：上传文档后，快速知道 cap table 哪些地方有问题、缺什么、证据在哪
- 明确不做：不直接输出正式法律意见、不覆盖所有复杂证券规则、不替代最终律师判断
- 给 UX Agent 的重点：围绕“证据可追溯、异常优先、对比清晰”设计体验
- 给开发 Agent 的重点：围绕“事件模型、重建逻辑、异常类型、证据链”组织系统能力
