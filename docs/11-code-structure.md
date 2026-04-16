# VeriCap 代码架构说明

## 文档目标

本文档用于说明 VeriCap 的目标代码架构，重点回答以下问题：

- 当前仓库应按哪些模块组织。
- 每个模块负责什么。
- 模块之间应该如何协作。
- 哪些边界在后续重构中需要保持稳定。
- 前端、后端、数据库和存储层应如何逐步演进到低耦合结构。

本文档应与 `docs/` 目录中的产品文档保持一致，尤其要服务于单页 `Evidence Workspace` 和“证据驱动的融资文件审计”这一核心方向。

## 产品约束

本架构以以下产品文档为约束：

- `00-product-brief.md`：VeriCap 是基于证据链的 cap table 审计辅助工作台，不是通用聊天产品。
- `03-core-workflow.md`：核心流程是 `Case -> Upload -> Classify -> Extract Evidence -> Build Timeline -> Build Working Cap Table -> Detect Conflict -> Human Review -> Export`。
- `04-prd.md`：核心业务对象包括 `Document Record`、`Evidence Record`、`Equity Event`、`Cap Table Row`、`Conflict Record`。
- `09-technical-roadmap.md`：产品应收敛为单页 `Evidence Workspace`。

## 总体架构结论

VeriCap 应按领域模块组织，而不是继续按页面堆叠功能。

- 前端：一个工作台壳层，多个业务区域组件，以及围绕用户动作组织的功能模块。
- 后端：API 层、服务层、仓储层、解析流水线和序列化层分离。
- 数据层：围绕 documents、evidence、events、cap table、conflicts、reviews、topology 建模。
- 存储层：输入文件、处理结果、SQLite 数据库和导出产物分离存放。

核心设计原则如下：

> 页面只负责组合模块，服务层只负责编排业务流程，仓储层只负责持久化，序列化层只负责构造前端需要的读模型。

## 根目录结构

```text
hackson/
  backend/            # Python 后端、API 入口、处理流水线、工作台存储
  frontend/           # React/Vite 前端工作台
  docs/               # 产品、技术和架构文档
  scripts/            # 一次性辅助脚本
  data/               # 本地样例输入文件
  storage/            # SQLite、处理结果、导出产物
  tests/              # 自动化测试
```

## 前端架构

### 前端目标

前端应收敛为一个单页工作台，而不是继续扩展多页面产品壳。

当前前端的关键入口如下：

- `frontend/src/App.tsx`：应用入口，负责挂载工作台。
- `frontend/src/context/WorkbenchContext.tsx`：工作台状态中心，负责快照拉取、节点选择、版本切换、上传和刷新。

目标前端结构如下：

```text
frontend/src/
  app/
    App.tsx
    providers/
    layout/
  shared/
    ui/
    lib/
    hooks/
    types/
    utils/
  entities/
    case/
    document/
    evidence/
    event/
    captable/
    conflict/
    topology/
    review/
  features/
    upload-case-files/
    switch-viewing-version/
    review-conflict/
    review-evidence/
    explain-result/
    export-review-summary/
  widgets/
    workspace-shell/
    ai-chat-panel/
    file-list-pane/
    history-pane/
    document-canvas/
    captable-panel/
    conflict-queue/
    topology-modal/
  pages/
    workspace/
```

### 前端模块说明

#### `app`

应用级装配层。

作用：

- 挂载应用入口。
- 注册全局 Provider。
- 管理顶层布局。
- 如果未来需要，可承载极少量路由装配。

边界：

- 不承载具体业务逻辑。
- 不直接处理上传、复核、cap table 推导等动作。

#### `shared`

通用技术基础层。

作用：

- 通用 UI 组件。
- HTTP 请求工具。
- 通用 Hook。
- 格式化工具。
- 非业务专属的基础类型。

边界：

- 可以被任何前端模块依赖。
- 不应反向依赖业务实体、功能模块或业务组件。

#### `entities`

稳定业务实体层。

建议的实体包括：

- `case`
- `document`
- `evidence`
- `event`
- `captable`
- `conflict`
- `topology`
- `review`

作用：

- 定义实体类型。
- 提供实体 selector 和 mapper。
- 提供轻量的只读展示辅助组件。

边界：

- 不负责业务流程动作。
- 不负责大块 UI 布局。

#### `features`

按“用户动作”拆分的功能层。

典型功能：

- 上传 case 文件。
- 切换当前 viewing version。
- 复核冲突。
- 复核证据。
- 导出复核结果。

作用：

- 封装一个动作或一个短链路交互。
- 连接实体数据和交互行为。

边界：

- 可以依赖 `entities` 和 `shared`。
- 不应演变成页面容器或大区域布局。

#### `widgets`

工作台内的大区域组件。

典型组件：

- `file-list-pane`
- `document-canvas`
- `history-pane`
- `captable-panel`
- `conflict-queue`
- `ai-chat-panel`
- `topology-modal`

作用：

- 在一个业务区域内组合 features 和 entities。
- 承担单个工作台区域的完整展示职责。

边界：

- 代表一个业务区域，而不是一个用户动作。
- 不应直接承担全局页面编排职责。

#### `pages`

页面装配层。

当前阶段建议只保留：

- `workspace`

作用：

- 将多个 widgets 组合成完整的单页工作台。

边界：

- 只做装配。
- 不直接写复杂业务逻辑。

### 前端模块关系

推荐依赖方向如下：

```text
pages / app
  -> widgets
  -> features
  -> entities
  -> shared
```

具体规则如下：

- `shared` 不能依赖 `entities`、`features`、`widgets`。
- `entities` 不能依赖 `features`、`widgets`。
- `features` 可以依赖 `entities` 和 `shared`。
- `widgets` 可以依赖 `features`、`entities` 和 `shared`。
- `pages` 可以依赖所有前端层，但职责仅限组合。

## 后端架构

### 后端目标

后端应从当前的“小型脚本式结构”逐步演进为“分层服务架构”。

当前后端核心文件如下：

- `backend/api_server.py`
- `backend/process_docx_data.py`
- `backend/workbench_store.py`

这些文件目前承担的职责过多，后续应逐步拆分。

目标后端结构如下：

```text
backend/
  app/
    main.py
    api/
      routers/
        cases.py
        files.py
        workbench.py
        topology.py
        review.py
        exports.py
    domain/
      case.py
      file.py
      evidence.py
      event.py
      captable.py
      conflict.py
      topology.py
      review.py
    services/
      case_service.py
      file_ingestion_service.py
      evidence_service.py
      event_service.py
      captable_service.py
      conflict_service.py
      topology_service.py
      workbench_service.py
      review_service.py
      export_service.py
    repositories/
      case_repo.py
      file_repo.py
      evidence_repo.py
      event_repo.py
      captable_repo.py
      conflict_repo.py
      topology_repo.py
      review_repo.py
      operation_log_repo.py
    pipeline/
      docx_parser.py
      classifier.py
      extractor.py
      llm_client.py
      processors/
        metadata.py
        dates.py
        financing.py
        rights.py
        risks.py
    serializers/
      workbench_snapshot.py
      node_detail.py
    db/
      connection.py
      migrations/
      schema.sql
```

### 后端模块说明

#### `api`

HTTP 接口入口层。

作用：

- 解析请求参数。
- 返回响应结构。
- 管理状态码。
- 完成接口路由分发。

边界：

- 不直接写 SQL。
- 不直接推导 cap table。
- 不直接手工拼装大型 workspace snapshot。

#### `domain`

核心业务模型层。

核心实体包括：

- `Case`
- `Document`
- `Evidence`
- `EquityEvent`
- `CapTableVersion`
- `Conflict`
- `ReviewDecision`
- `TopologyNode`

作用：

- 定义稳定业务实体。
- 提供业务层共享的数据语义。

边界：

- 不依赖 FastAPI。
- 不依赖 SQLite。
- 不依赖前端 DTO。

#### `services`

业务流程编排层。

典型职责：

- 上传文件并触发抽取流程。
- 刷新工作台状态。
- 计算 working cap table。
- 检测冲突。
- 处理人工复核动作。

作用：

- 串联业务步骤。
- 协调 pipeline、repository、serializer。

边界：

- 不写原始 SQL。
- 不承担 HTTP 入口职责。

#### `repositories`

持久化访问层。

作用：

- 读写数据库记录。
- 将数据库行映射为领域对象。
- 隔离 SQLite 细节。

边界：

- 只处理持久化。
- 不负责业务判断。
- 不直接拼前端读模型。

存在意义：

- 通过 repository 隔离 SQLite，后续切换 PostgreSQL 时可以降低重写成本。

#### `pipeline`

文档解析与抽取流水线。

作用：

- 文件解析。
- 本地规则抽取。
- LLM 增强抽取。
- 文档级候选结果生成。

边界：

- 不关心前端界面结构。
- 不直接生成工作台 UI 所需的快照。

#### `serializers`

前端读模型构造层。

作用：

- 生成 `WorkbenchSnapshot`。
- 生成 topology node detail。
- 将后端数据整理成前端工作台所需结构。

边界：

- 不承担业务规则判断。
- 不承担持久化职责。

### 后端模块关系

推荐依赖方向如下：

```text
api
  -> services
  -> serializers
services
  -> repositories
  -> domain
  -> pipeline
repositories
  -> db
  -> domain
serializers
  -> domain
```

具体规则如下：

- `api` 依赖 `services` 和 `serializers`。
- `services` 依赖 `repositories`、`domain` 和 `pipeline`。
- `repositories` 依赖 `db` 和 `domain`。
- `serializers` 依赖 `domain` 和 service 输出。
- `domain` 不依赖其上层模块。

补充边界规则：

- `repositories` 不应调用 HTTP 接口。
- `pipeline` 不应返回 UI 专属结构。
- `serializers` 不应写业务决策。
- `services` 不应嵌入原始 SQL。

## 数据与存储架构

### 存储目录

```text
data/       # 输入样例文件和上传源文件
storage/    # 处理后的 JSON、SQLite、导出产物、生成结果
```

### 推荐数据模型

建议围绕核心业务流程组织数据表：

```text
cases
documents
document_classifications
evidence_records
equity_events
captable_versions
captable_rows
conflicts
review_decisions
topology_nodes
topology_refs
operation_logs
exports
```

### 各数据表作用

#### `cases`

一个审计工作台的顶层容器。

#### `documents`

记录上传文件元信息、处理状态和来源身份。

#### `document_classifications`

记录文件类型识别结果、置信度和抽取路由信息。

#### `evidence_records`

记录证据原子，包括来源文本、位置和置信度。

#### `equity_events`

记录由证据归并而成的股权业务事件。

#### `captable_versions`

记录 working cap table 的不同版本快照。

#### `captable_rows`

记录 cap table 版本中的逐行结果。

#### `conflicts`

记录 evidence、event 和 cap table 推导之间的不一致事项。

#### `review_decisions`

记录人工确认、驳回、覆盖和待跟进动作。

#### `topology_nodes`

记录版本、分支和节点状态。

#### `topology_refs`

记录节点之间的引用和关联关系。

#### `operation_logs`

记录系统操作和用户操作，用于可追溯和审计。

#### `exports`

记录导出摘要、报告等产物。

## 端到端模块关系

推荐的数据流如下：

```text
输入文件
  -> Document
  -> Classification
  -> Evidence
  -> Equity Event
  -> Cap Table Version / Rows
  -> Conflict Detection
  -> Review Decision
  -> Workspace Read Model
  -> Frontend Widgets
```

这个数据流保证系统始终以证据为核心，并确保前端中的关键结果可以回溯到来源文件。

## 核心解耦原则

后续重构中，以下边界应保持稳定：

- `Document` 不应直接依赖 `Topology`。
- `Topology` 是浏览结构，不是业务真相源。
- `Evidence` 是最小可信原子。
- `Event` 由 `Evidence` 推导。
- `CapTable` 由 `Event` 推导。
- `Conflict` 基于 `Evidence`、`Event` 和 `CapTable` 检出。
- `ReviewDecision` 可以覆盖解释结果，但不能抹掉原始证据。
- `WorkbenchSnapshot` 是读模型，不是写模型。

## 当前重构优先级

### P0

- 保持前端为单页 workspace。
- 停止继续向 `frontend/src/pages/dashboard/Dashboard.tsx` 叠加大块新逻辑。
- 从 `backend/workbench_store.py` 中拆出 `repositories`、`services`、`serializers`。
- 保持上传能力在 workspace 内部，而不是恢复独立 intake 页面。

### P1

- 将 `conflict` 和 `review decision` 提升为一等模块。
- 将 `WorkbenchContext` 拆为 provider 和 feature action。
- 将超大的 workspace payload 逐步收敛为更清晰的模块级 API 边界。

### P2

- 增加 export、audit、deletion 等独立服务和功能模块。
- 将后端逐步迁移到完整的 `backend/app/...` 分层结构。
- 继续降低 dashboard 工作台中的跨模块耦合。

## 目标状态

最终希望仓库达到以下状态：

- 前端只有一个工作台页面。
- 前端模块按领域和动作组织，而不是按展示页面组织。
- 后端采用清晰的分层服务结构。
- 持久化通过 repository 隔离。
- 系统始终围绕 evidence-first 数据流工作。
- 业务真相和 UI 读模型严格分离。

这样的结构更利于扩展、测试和后续产品化演进。
