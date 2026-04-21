# 技术路线图

## 当前原型概况

当前仓库包含：

- React/Vite 前端。
- FastAPI 后端。
- DOCX 处理流水线。
- SQLite 工作台存储。
- 样例和已处理融资数据。
- documents、workbench、topology、upload、node actions、viewing version、chat 等 API。
- dashboard、document intake、evidence review、event timeline、working cap table、topology graph 等前端模块。

## 产品化方向

Beta 应将当前原型收敛为可靠的单页 Evidence Workspace。现有模块可以复用，但实现优先级应放在一个端到端复核闭环，而不是多个展示型页面。

## Phase 1：文档与范围锁定

交付物：

- 产品简报。
- Beta 范围。
- 用户画像。
- 核心工作流。
- PRD。
- 数据安全政策。
- AI 风险政策。
- Beta 内测计划。

退出标准：

- 团队同意 P0 范围。
- AI 开发需求引用 PRD 需求编号。
- 范围外事项被明确推迟。

## Phase 2：可进入、可运行、可恢复的 Beta 闭环

交付物：

- 单命令启动或受控环境访问入口。
- 稳定的本地后端启动流程。
- 稳定的前端启动流程。
- 环境状态暴露。
- 样例 case 或演示入口。
- DOCX 上传和处理状态。
- workbench snapshot API。
- 带来源引用的证据记录。
- working cap table 快照。
- 冲突或低置信度复核队列。
- 用户可见错误与恢复提示。
- 处理失败可见。

退出标准：

- 用户可以进入系统并理解当前是否可操作。
- 样例融资文件包可以重复处理。
- 关键输出能追溯到来源证据。
- 错误能展示给用户，且用户知道下一步动作。

## Phase 3：首屏工作台收敛

交付物：

- 单页 workspace shell。
- 文档查看或比对画布。
- AI chat / explanation 面板。
- 历史版本面板。
- 文件列表面板。
- 嵌入式 working cap table 区域。
- 冲突和低置信度事项复核队列。

退出标准：

- 用户进入后不需要理解系统结构，也能立即开始复核。
- 用户可以在一个工作台里完成核心复核流程。
- 版本切换能同步更新文档上下文和 cap table 上下文。
- UI 不依赖大段说明文字。

## Phase 4：Beta 安全与运营

交付物：

- 数据保留和删除流程。
- 环境变量文档。
- 安全样例数据政策。
- 基础操作日志。
- 可导出的 Beta 反馈或复核摘要。
- 内部演示 runbook。

退出标准：

- 团队能说明上传文件存放在哪里。
- 团队能删除内测参与者数据。
- 团队能在不暴露密钥或敏感数据的情况下演示。

## Phase 5：私密内测迭代

交付物：

- 反馈收集。
- 准确率问题日志。
- 失败案例日志。
- 排好优先级的改进 backlog。
- 下一批支持文件类型决策。

退出标准：

- 至少 3 位法律专业人员完成测试。
- 主要产品阻碍已知。
- 主要抽取失败案例已知。
- 下一轮范围基于证据，而不是猜测。

## 工程 Backlog 种子

P0：

- 围绕 case、document、evidence、event、cap table row、conflict、operation log 统一数据模型。
- 启动编排。
- 连接状态提示。
- 示例数据入口。
- 确保每个关键抽取值有 evidence metadata。
- 增加处理失败状态和用户可见错误提示。
- 错误文案与恢复动作标准化。
- 增加低置信度复核状态。
- 增加 Beta 安全的数据删除流程。

P1：

- 构建单页 Evidence Workspace。
- 增加 cap table 行和冲突事项解释接口。
- 增加复核摘要导出。
- 增加文件分类和抽取字段的用户修正流程。

P2：

- 增加角色权限。
- 增加 PDF/OCR 流水线。
- 增加律所 DMS 集成。
- 增加多 matter 协作。
