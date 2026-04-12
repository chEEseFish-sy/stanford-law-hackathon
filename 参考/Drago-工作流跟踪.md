# Drago 工作流跟踪

## 1. 当前阶段
- 当前推进阶段：UX 视觉深化准备（社区增强与受控互动策略已并入）
- 当前结论：已把 Community 一级页、发布加号、Mine 聚合页、帖子评论和“聊天后置到认证服务场景”的策略并入产品定义与 Figma Prompt，并新增基于既有 Figma 稿继续修改的增量 Prompt；下一步应由设计侧在旧稿上做结构升级，再进入 SwiftUI 开发实现。
- 更新规则：每次生成或调整相关文档后，都需要同步更新本文件中的工作流状态与文档修改时间。

## 2. 工作流步骤
| 步骤 | 产出物 | 当前状态 | 最新结论 |
| --- | --- | --- | --- |
| Step 1 | 市场调研 | 已完成 | 已明确市场机会在阶段式任务流、高信任解释、失败补救与文化适应。 |
| Step 2 | 产品设计方案 | 已完成 | 已明确产品目标、范围、优先级、商业模式与后续设计顺序。 |
| Step 3 | User Stories | 已完成 | 已把核心任务、验收标准与版本边界拆成用户故事。 |
| Step 4 | 业务逻辑设计 | 已完成 | 已形成 8 阶段模型、阶段切换规则、异常补救与文化适应挂载逻辑。 |
| Step 5 | 模块设计 | 已完成 | 已完成模块边界、模块职责、跨模块依赖，并补充模块触发时机、回流规则与状态反馈。 |
| Step 6 | 技术架构设计 | 已完成 | 已完成共享状态、任务状态机、缓存同步、外部桥接、数据库模块映射、核心字段范围与全链路技术栈说明，并确定云端主数据库为腾讯云 PostgreSQL。 |
| Step 7 | 前端详细设计 | 已完成 | 已完成 iOS 页面清单、导航结构、页面级数据来源、关键状态页、外跳回流页、补救页、弱网页和可复用组件约束。 |
| Step 8 | UX 视觉深化 / 开发实现 | 进行中 | 已输出包含 Community、发布加号、Mine 聚合页和受控互动边界的 Figma Prompt，并新增适用于旧 Figma 稿的增量改版 Prompt；下一步需要在现有 Figma 基础上完成结构升级，再基于定稿进入 SwiftUI 实现。 |

## 3. 本轮 Figma Make Prompt 摘要
- 已在 ui-design/Drago-Figma-Make-Prompt.md 下输出总 Prompt，并补充 5 份拆分后的分批投喂文档。
- 已新增 ui-design/Drago-Figma-Make-Revision-Prompt.md，用于在已经生成好的 Figma 稿上继续修改，而不是重新从空白生成。
- 已把页面数量、一级结构、关键链路页、状态页、组件数量和层级关系压缩成可直接生成视图的 Prompt 口径，并把一级结构调整为 Home / Discover / 加号 / Community / Mine。
- 已单独列出核心组件清单，包括 StageHeader、TaskCard、TrustMetaBar、TaskChecklist、RecoveryActionCard、ReturnActionPanel、OfflineBanner，以及 Community / 评论相关组件。
- 01-05 拆分 Prompt 继续保留为从零起稿参考；若已有旧版 Figma，本轮应优先使用 Revision Prompt 做增量改版。
- 已明确聊天边界：MVP 仅做帖子评论，不做陌生人私聊；认证地陪 / 导游 / 本地用户会话后置到 P2。
- 下一步应由设计侧基于旧 Figma 稿吸收导航、Community、发布、Mine 和任务挂帖变更，再把修订稿交给开发侧实现。

## 4. 下一步 UX / 开发输入要求
- Figma 页面稿必须保留页面数据来源、进入条件、退出路径、异常路径和关键状态切换说明。
- 视觉深化优先顺序应保持为：Home → Task Detail → Return Confirmation → Recovery → Offline / Expired → Discover → Community → Mine → 发布加号。
- 开发实现必须优先搭建 RootShell、Home Flow、Task Detail、Return Confirmation、Recovery 与状态组件，再补 Discover / Community / Mine / 发布加号。
- 所有页面必须直接消费 TaskState、ReturnContext、FailureEvent、SyncSnapshot 等共享对象，不允许重新定义一套页面内状态。
- 任何视觉或实现调整都不能破坏“首页 5 秒判断下一步任务”和“外跳返回不自动完成”两条主约束。
- Community 与聊天相关设计必须遵守“评论先于私聊、认证先于会话、服务上下文先于聊天大厅”的边界。

## 5. 文档最新修改时间
| 文档 | 路径 | 最新修改时间 |
| --- | --- | --- |
| Drago 工作流跟踪.md | Drago-工作流跟踪.md | 2026-04-07 15:44:00 |
| prd_input.md | product-design/prd_input.md | 2026-04-05 15:59:30 |
| PRD-Dragon.md | product-design/PRD-Dragon.md | 2026-04-06 17:43:22 |
| Drago-市场调研报告.docx | product-design/Drago-市场调研报告.docx | 2026-04-07 15:44:00 |
| Drago-产品设计方案.docx | product-design/Drago-产品设计方案.docx | 2026-04-07 15:44:00 |
| Drago-App图标设计简报.docx | product-design/Drago-App图标设计简报.docx | 2026-04-07 15:44:00 |
| Drago-User Stories.docx | product-design/Drago-User Stories.docx | 2026-04-06 17:45:20 |
| Drago-业务逻辑设计.docx | product-design/Drago-业务逻辑设计.docx | 2026-04-07 15:44:00 |
| Drago-模块设计.docx | product-design/Drago-模块设计.docx | 2026-04-07 15:44:00 |
| Drago-技术架构设计.docx | product-design/Drago-技术架构设计.docx | 2026-04-07 15:44:00 |
| Drago-前端详细设计.docx | product-design/Drago-前端详细设计.docx | 2026-04-07 15:44:00 |
| Drago-Figma-Make-Prompt.md | ui-design/Drago-Figma-Make-Prompt.md | 未生成 |
| Drago-Figma-Make-Revision-Prompt.md | ui-design/Drago-Figma-Make-Revision-Prompt.md | 未生成 |
| Drago-Figma-Make-Prompt-01-Global.md | ui-design/Drago-Figma-Make-Prompt-01-Global.md | 未生成 |
| Drago-Figma-Make-Prompt-02-Home-Task-Return.md | ui-design/Drago-Figma-Make-Prompt-02-Home-Task-Return.md | 未生成 |
| Drago-Figma-Make-Prompt-03-Recovery-States.md | ui-design/Drago-Figma-Make-Prompt-03-Recovery-States.md | 未生成 |
| Drago-Figma-Make-Prompt-04-Discover-Saved-Profile.md | ui-design/Drago-Figma-Make-Prompt-04-Discover-Saved-Profile.md | 未生成 |
| Drago-Figma-Make-Prompt-05-Components.md | ui-design/Drago-Figma-Make-Prompt-05-Components.md | 未生成 |

## 6. 支撑脚本最新修改时间
| 文件 | 路径 | 最新修改时间 |
| --- | --- | --- |
| generate_docs.py | tool/generate_docs.py | 2026-04-07 15:43:41 |
| create_stories.py | tool/create_stories.py | 2026-04-06 10:50:58 |
| update_docx.py | tool/update_docx.py | 2026-04-05 15:59:49 |
| model_client.py | tool/model_client.py | 2026-04-06 00:28:50 |

## 7. 后续执行约束
- 技术架构设计必须严格承接模块边界，不允许重新按外部工具名称拆顶层结构。
- 每次文档更新后都要重新生成相关 docx，并刷新本文件中的修改时间。
- 任何后续设计都必须明确触发时机、返回路径与状态反馈，不能只写功能清单。
- 前端详细设计必须直接消费共享状态、数据库归属和任务状态机，不允许页面各自维护一套完成态、回流逻辑和数据真相。
- 后续视觉深化与开发实现必须基于现有技术栈矩阵、数据库归属和共享状态展开，不允许脱离这些前提重写数据来源。
- 所有新增设计产物都要明确 In Scope、Out of Scope、MVP / P1 / P2 边界，以及给 UX / 开发的 handoff。
