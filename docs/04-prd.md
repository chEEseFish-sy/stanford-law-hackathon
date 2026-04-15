# 产品需求文档

## 版本

Beta v0.1 产品化草案。

## 目标

让法律专业人员可以上传一组融资文件，查看抽取的股权证据，检查系统生成的 working cap table，识别冲突，并在做出律师控制的最终判断前，将关键结果追溯回来源文件。

## 产品方向

VeriCap 应从黑客松原型收敛为可控私密内测产品。Beta 应聚焦单页 Evidence Workspace，即使当前代码库仍包含 dashboard、evidence、timeline、cap table、topology 等独立页面。

## 用户故事

### US-001：上传文件

作为法律专业人员，我希望上传一组融资文件，以便 VeriCap 作为一个 case 统一处理。

### US-002：查看文件状态

作为法律支持人员，我希望看到每个文件的处理状态，以便知道哪些成功、失败或需要关注。

### US-003：复核证据

作为融资律师，我希望每个抽取字段都能链接到来源证据，以便判断抽取是否可靠。

### US-004：查看 Working Cap Table

作为融资律师，我希望查看从法律文件生成的 working cap table，以便与现有记录比较。

### US-005：复核冲突

作为融资律师，我希望系统优先提示冲突和缺失证据，以便把复核时间集中在实质风险上。

### US-006：请求解释

作为用户，我希望询问系统为什么生成某一行 cap table 或提示某个冲突，以便理解证据链。

### US-007：切换历史版本

作为用户，我希望在历史文件或拓扑版本之间切换，以便查看 working cap table 如何变化。

### US-008：保留人工控制

作为律师，我希望确认、驳回或标记待跟进，以便 AI 不会替我做最终法律判断。

## 功能需求

| ID | 需求 | 优先级 | 说明 |
| --- | --- | --- | --- |
| FR-001 | 支持 case 级工作区 | P0 | 早期 Beta 可以使用默认 case，但要明确范围。 |
| FR-002 | 支持 DOCX 上传 | P0 | 原型已支持，首轮保持窄范围。 |
| FR-003 | 展示文件处理状态 | P0 | 包括处理中和失败状态。 |
| FR-004 | 识别融资文件类型 | P0 | 显示置信度或复核状态。 |
| FR-005 | 抽取股权相关证据 | P0 | 必须包含来源引用。 |
| FR-006 | 生成股权事件时间线 | P0 | 事件必须链接证据。 |
| FR-007 | 生成 working cap table 快照 | P0 | 必须标记为复核辅助。 |
| FR-008 | cap table 行链接来源证据 | P0 | 关键行不能没有证据支持。 |
| FR-009 | 检测冲突和缺失证据 | P0 | 优先复核队列，而不是泛化摘要。 |
| FR-010 | 支持人工复核状态 | P0 | 确认、驳回、待跟进。 |
| FR-011 | 对选定结果提供 AI 解释 | P1 | 必须引用证据和不确定性。 |
| FR-012 | 支持 viewing version 切换 | P1 | 可复用现有 topology 模型。 |
| FR-013 | 导出 Beta 复核摘要 | P1 | 后续可支持 Markdown、DOCX 或 PDF。 |
| FR-014 | 多用户角色权限 | P2 | 第一轮受控内测可暂不做。 |
| FR-015 | PDF OCR | P2 | Beta v0.1 明确不做。 |

## 非功能需求

- 关键输出必须有来源证据。
- 低置信度输出必须可见且可复核。
- 处理失败必须可见且可恢复。
- 未经明确书面同意，不得将上传文件用于模型训练。
- 敏感内测文件必须有明确访问、保留和删除规则。
- UI 文案不得暗示系统提供最终法律意见。
- 产品必须能使用样例或脱敏数据完成演示。

## 数据需求

### Document Record

- `id`
- `case_id`
- `filename`
- `document_type`
- `classification_confidence`
- `processing_status`
- `uploaded_at`
- `source_path` 或存储引用

### Evidence Record

- `id`
- `case_id`
- `document_id`
- `field_type`
- `value`
- `source_text`
- `source_location`
- `confidence`
- `review_status`

### Equity Event

- `id`
- `case_id`
- `event_type`
- `effective_date`
- `parties`
- `security_type`
- `shares`
- `price_per_share`
- `amount`
- `source_evidence_ids`
- `confidence`
- `review_status`

### Cap Table Row

- `id`
- `case_id`
- `version_id`
- `holder`
- `share_class`
- `shares`
- `ownership_percentage`
- `source_event_ids`
- `source_evidence_ids`
- `confidence`
- `review_status`

### Conflict Record

- `id`
- `case_id`
- `conflict_type`
- `severity`
- `description`
- `affected_documents`
- `affected_fields`
- `source_evidence_ids`
- `recommended_review_action`
- `review_status`

## 验收标准

- 用户可以上传 DOCX 融资文件包并看到处理进度。
- 用户可以查看带来源文本或来源位置的抽取证据。
- 用户可以查看由证据生成的 working cap table。
- 用户可以识别哪些 cap table 行是低置信度或由冲突驱动。
- 用户可以将关键值追溯到来源文档。
- 系统不得把生成结果呈现为最终法律意见。
- 处理错误要向用户展示，并为调试保留记录。

## 实现约束

Beta v0.1 阶段不要把产品扩展成通用法律助手。如果某个功能不能提升证据抽取、working cap table 复核、冲突检测或律师控制的复核流程，应暂缓。
