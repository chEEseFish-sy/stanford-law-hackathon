# 拓扑模块技术设计文档

## 1. 模块定位

拓扑模块用于表达交易文件、草案文件、Cap Table 版本之间的结构关系。它不是一个单纯的 UI 图形模块，而是文件处理结果、交易版本演进、草案审批状态、Cap Table 生成过程和历史回溯能力的结构化入口。

最终产品期望达到的效果是：用户上传交易文件后，系统自动完成文件整理、分类、结构化处理、证据审理和 Cap Table 影响分析，并根据处理结果自动生成或更新拓扑图。拓扑图中的每个节点都应代表一个真实业务对象，例如交易文件、草案文件、Cap Table 版本或分析结果，而不是空的 UI 图标。

## 2. 核心目标

拓扑模块需要支持以下能力：

1. 用户每上传一次文件，系统自动更新拓扑图。
2. 已敲定交易文件进入主干，草拟交易文件先进入分支。
3. 草案被认可后，可以合并进主干，并生成新的主干版本。
4. 草案被董事会否决后，不删除，而是保留为被否决分支。
5. 每个节点需要标注重要信息，例如文件名、文件类型、交易时间、状态、处理进度等。
6. 每个节点需要连接数据库中的真实文件和结构化处理结果。
7. 用户双击节点后，可以在 Web 页面右侧查看该节点对应的文件 portal、结构化数据、证据来源和 AI 分析解释。
8. 系统应支持历史回溯，允许用户查看任意历史 Cap Table 版本。
9. 拓扑模块应与文件模块、数据处理模块、Cap Table 生成模块保持同步。

## 3. 设计原则

### 3.1 拓扑结构与业务数据解耦

拓扑节点只负责描述结构关系，不应直接保存完整文件内容、完整结构化结果或完整 Cap Table 数据。

拓扑节点保存：

- 节点 ID
- 父节点 ID
- 子节点关系
- 跨节点引用关系
- 节点状态
- 节点类型
- 展示用标题
- 关联业务实体 ID

业务数据单独存储在文件表、结构化结果表、Cap Table 版本表中。拓扑节点通过 `entityId` 和 `entityType` 关联这些业务实体。

这样可以保证拓扑模块保持轻量，同时每个节点又能连接到真实数据库数据。

### 3.2 自动生成，而不是手动维护

拓扑图不应依赖用户手动拖拽或手动创建节点。用户上传文件后，系统应通过文件处理流水线自动判断该文件应该进入主干、成为分支、引用其他节点，还是更新已有节点状态。

用户可以对节点执行合并、否决、归档、回溯等操作，但基础拓扑关系应由系统根据业务规则自动生成。

### 3.3 保留历史，不覆盖旧状态

草案合并主干时，不应覆盖原草案节点，也不应直接修改旧的主干节点。正确做法是生成一个新的主干节点，表示合并草案之后的新 Cap Table 版本。

草案被否决时，也不应删除该节点，而是将其标记为 `rejected`，继续保留在拓扑图中，方便后续审计、解释和回溯。

### 3.4 节点是业务入口

每个拓扑节点都应该能打开对应的业务详情。节点不仅仅用于展示关系，还应该成为用户进入文件、结构化数据、证据来源、AI 分析结果和 Cap Table 影响说明的入口。

## 4. 核心数据模型

### 4.1 `TopologyNode`

```ts
interface TopologyNode {
  id: string;
  parentId: string | null;
  children: string[];
  refs: string[];
  depth: number;
  index: number;
  label: string;
  status:
    | 'processing'
    | 'trunk'
    | 'draft'
    | 'merged'
    | 'rejected'
    | 'archived'
    | 'deleted'
    | 'error';
  nodeType:
    | 'document'
    | 'draft_document'
    | 'finalized_document'
    | 'captable_version'
    | 'analysis_result';
  entityId: string;
  entityType: 'file' | 'transaction' | 'captable' | 'analysis';
  createdAt: string;
  updatedAt: string;
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `id` | 拓扑节点唯一 ID |
| `parentId` | 父节点 ID，根节点为 `null` |
| `children` | 子节点 ID 列表 |
| `refs` | 跨节点引用关系，例如依赖、冲突、证据引用 |
| `depth` | 节点深度，用于布局 |
| `index` | 同层排序，用于稳定展示 |
| `label` | 节点展示名称 |
| `status` | 节点业务状态 |
| `nodeType` | 节点类型 |
| `entityId` | 关联业务实体 ID |
| `entityType` | 关联业务实体类型 |
| `createdAt` | 创建时间 |
| `updatedAt` | 更新时间 |

### 4.2 `DocumentMeta`

```ts
interface DocumentMeta {
  id: string;
  fileName: string;
  fileType:
    | 'finalized_transaction'
    | 'draft_transaction'
    | 'board_resolution'
    | 'side_letter'
    | 'other';
  transactionDate?: string;
  uploadedAt: string;
  sourcePath: string;
  storageProvider: 'local' | 'private_db' | 'object_storage';
  processingStatus:
    | 'pending'
    | 'processing'
    | 'processed'
    | 'needs_review'
    | 'error';
  evidenceStatus:
    | 'unverified'
    | 'verified'
    | 'conflict'
    | 'rejected';
  summary: string;
}
```

### 4.3 `StructuredResult`

```ts
interface StructuredResult {
  id: string;
  documentId: string;
  transactionType: string;
  parties: string[];
  effectiveDate?: string;
  captableImpactSummary: string;
  extractedTerms: Array<{
    name: string;
    value: string;
    sourceLocation: string;
  }>;
  evidenceFindings: Array<{
    field: string;
    value: string;
    source: string;
    confidence: number;
    issue?: string;
  }>;
  aiExplanation: string;
  createdAt: string;
}
```

### 4.4 `CapTableVersion`

```ts
interface CapTableVersion {
  id: string;
  topologyNodeId: string;
  parentVersionId?: string;
  versionName: string;
  generatedFromDocumentIds: string[];
  status:
    | 'current'
    | 'historical'
    | 'draft'
    | 'rejected'
    | 'archived';
  summary: string;
  rows: Array<{
    holderName: string;
    securityType: string;
    shares: number;
    ownershipPercentage: number;
    sourceDocumentId: string;
    sourceLocation: string;
  }>;
  createdAt: string;
}
```

## 5. 自动更新拓扑图的流程

拓扑图应由文件上传和数据处理流程驱动。

推荐流程如下：

```text
用户上传文件
↓
文件模块保存原始文件
↓
生成 DocumentMeta
↓
文件解析与分类
↓
证据真实性审理
↓
结构化结果生成
↓
判断文件应进入主干还是分支
↓
创建或更新 TopologyNode
↓
生成或更新 CapTableVersion
↓
前端刷新拓扑图
```

### 5.1 已敲定交易文件

如果系统判断上传文件是已敲定交易文件：

- 文件进入主干。
- 系统基于当前主干末端创建新的主干节点。
- 该节点关联对应的 `DocumentMeta` 和 `StructuredResult`。
- 系统根据该文件生成新的 `CapTableVersion`。
- 当前主干版本更新为新节点。

### 5.2 草拟交易文件

如果系统判断上传文件是草拟交易文件：

- 文件不会直接进入主干。
- 系统从当前主干版本或相关交易节点 fork 出一个分支。
- 分支节点状态为 `draft`。
- 系统生成草案对应的结构化结果和 Cap Table 影响分析。
- 用户可以查看分析结果后决定是否合并。

### 5.3 被否决草案

如果草案提交董事会后被否决：

- 草案节点状态更新为 `rejected`。
- 节点仍然保留在拓扑图中。
- 系统不修改当前主干版本。
- 用户仍可打开该节点查看文件、分析结果和否决记录。

### 5.4 被认可草案

如果用户认可草案并决定合并：

- 原草案节点状态更新为 `merged`。
- 系统基于当前主干末端生成新的主干节点。
- 新主干节点通过 `refs` 或 `mergedFrom` 记录来源草案。
- 系统生成新的 `CapTableVersion`。
- 当前主干版本更新为新主干节点。
- 原草案节点仍保留，用于追溯。

## 6. 拓扑模块与文件模块的同步

拓扑模块需要与文件模块保持强关联。

建议数据库至少包含以下表：

| 表名 | 作用 |
| --- | --- |
| `files` | 保存原始文件元数据 |
| `file_processing_results` | 保存文件解析、分类、证据审理和 AI 分析结果 |
| `captable_versions` | 保存每个 Cap Table 版本 |
| `topology_nodes` | 保存拓扑节点 |
| `topology_refs` | 保存跨节点引用关系 |
| `operation_logs` | 保存用户操作记录，例如合并、否决、归档、回溯 |

拓扑节点不直接保存文件内容，而是通过 `entityId` 关联文件、交易或 Cap Table 版本。

### 6.1 推荐关系

- `topology_nodes.entityId -> files.id`
- `topology_nodes.entityId -> captable_versions.id`
- `file_processing_results.documentId -> files.id`
- `captable_versions.generatedFromDocumentIds -> files.id[]`
- `topology_refs.fromNodeId -> topology_nodes.id`
- `topology_refs.toNodeId -> topology_nodes.id`

### 6.2 异步处理状态

文件解析和 AI 分析可能是异步任务，因此拓扑节点需要支持中间状态。

例如：

- `processing -> draft`
- `processing -> trunk`
- `processing -> needs_review`
- `processing -> error`

用户上传文件后，可以先在拓扑图中看到一个 `processing` 节点。处理完成后，节点自动更新为 `trunk`、`draft` 或 `error`。

## 7. 前端交互设计

### 7.1 拓扑图展示

拓扑图应展示以下信息：

- 文件名
- 文件类型
- 交易时间
- 节点状态
- 是否为主干
- 是否为草案
- 是否已合并
- 是否被否决
- 是否归档
- 是否存在冲突或证据问题

不同状态应有明显视觉区分。

例如：

| 状态 | 展示含义 |
| --- | --- |
| `trunk` | 当前主干或历史主干 |
| `draft` | 草案分支 |
| `merged` | 已合并草案 |
| `rejected` | 被否决草案 |
| `archived` | 已归档节点 |
| `processing` | 正在处理 |
| `error` | 处理失败 |

### 7.2 节点操作

推荐支持以下操作：

| 操作 | 说明 |
| --- | --- |
| 单击节点 | 选中节点并高亮相关路径 |
| 双击节点 | 打开右侧详情 portal |
| 合并草案 | 将草案合并进主干 |
| 否决草案 | 将草案标记为 `rejected` |
| 归档节点 | 将节点标记为 `archived` |
| 回溯查看 | 将当前查看版本切换到历史节点 |
| 查看来源 | 展示该节点的数据来源 |
| 查看冲突 | 展示该节点与其他节点的冲突关系 |

### 7.3 右侧详情 Portal

双击节点后，右侧应展示该节点对应的业务详情。

详情内容包括：

- 文件名
- 文件类型
- 上传时间
- 交易时间
- 当前状态
- 文件摘要
- 文件预览入口
- 结构化抽取结果
- Cap Table 影响摘要
- 证据审理结果
- AI 分析解释
- 数据来源
- 相关节点
- 可执行操作

结构化数据不应以 JSON 形式展示，而应转换为人类易读的形式。

例如：

| 字段 | 内容 | 来源 | 置信度 |
| --- | --- | --- | --- |
| 交易类型 | SAFE | 文件第 2 页 | 98% |
| 投资金额 | 1,000,000 USD | 文件第 4 页 | 96% |
| 生效日期 | 2026-02-01 | 文件第 1 页 | 93% |

## 8. 主干、分支、合并与回溯

### 8.1 主干

主干表示当前被认可的交易演进路径和 Cap Table 版本链。

主干节点通常由以下内容产生：

- 已敲定交易文件
- 已被用户确认并合并的草案
- 已生效的董事会决议
- 系统确认后的 Cap Table 版本

### 8.2 分支

分支表示尚未被认可或尚未生效的候选交易。

分支节点通常由以下内容产生：

- 草拟交易文件
- 待审批交易
- 需要人工确认的文件
- 存在证据冲突的文件
- 被否决但需要保留记录的文件

### 8.3 合并

合并操作不应覆盖旧节点。

合并草案时，应执行以下操作：

1. 校验草案状态是否允许合并。
2. 校验草案是否存在未解决证据冲突。
3. 将草案节点状态更新为 `merged`。
4. 基于当前主干末端生成新的主干节点。
5. 新主干节点引用草案节点。
6. 生成新的 `CapTableVersion`。
7. 记录操作日志。

### 8.4 否决

否决操作不删除节点。

否决草案时，应执行以下操作：

1. 将草案节点状态更新为 `rejected`。
2. 记录否决原因。
3. 保留文件、结构化结果和 AI 分析结果。
4. 当前主干版本不变。

### 8.5 回溯

回溯不是删除后续版本，也不是恢复数据库快照。

回溯只表示将“当前查看版本”切换到某个历史节点。

系统应区分：

| 概念 | 说明 |
| --- | --- |
| 当前主干版本 | 业务上最新认可的 Cap Table 版本 |
| 当前查看版本 | 用户当前正在查看的历史或当前版本 |

这样用户可以查看历史 Cap Table，而不影响当前业务状态。

## 9. 数据隐私、归档与删除

这一部分可以作为独立的存储与合规模块设计，但拓扑模块需要预留相关状态和接口。

产品理想效果类似 ChatGPT 的历史记录：用户可以查看历史项目、历史上传文件、历史分析结果和历史 Cap Table 版本。数据应存储在本地化或私密性较好的数据库中，并支持归档和删除。

### 9.1 Case / Workspace 维度

建议引入 case 或 workspace 概念。

一个 case 表示一个完整业务项目，包含：

- 上传文件
- 文件处理结果
- 拓扑图
- Cap Table 版本
- 用户操作记录
- 审批记录
- 导出文件包

### 9.2 归档

业务完成后，可以将整个 case 标记为 `archived`。

归档含义：

- 数据仍然保留。
- 默认不出现在活跃项目中。
- 仍然可以搜索、查看、导出。
- 不再主动参与新的文件处理任务。

### 9.3 删除

删除建议分为软删除和硬删除。

软删除：

- 标记为 `deleted`。
- 短期内允许恢复。
- 默认不展示。

硬删除：

- 删除原始文件。
- 删除结构化处理结果。
- 删除 Cap Table 版本。
- 删除拓扑节点。
- 删除向量索引和缓存。
- 删除操作日志中可识别的敏感内容，或进行脱敏保留。

如果系统使用向量数据库或 embedding 检索，删除文件时必须同步删除相关索引数据。

### 9.4 隐私建议

建议支持：

- 私有数据库部署。
- 租户隔离。
- 文件加密存储。
- 数据库字段级加密。
- 操作审计日志。
- 可配置数据保留周期。
- 可导出完整交易文件包。
- 可清除 AI 分析缓存和向量索引。

## 10. 推荐接口设计

### 10.1 获取拓扑图

```http
GET /api/cases/:caseId/topology
```

返回：

```ts
interface TopologyResponse {
  nodes: TopologyNode[];
  refs: Array<{
    fromNodeId: string;
    toNodeId: string;
    refType: 'depends_on' | 'conflicts_with' | 'derived_from' | 'references';
  }>;
  currentTrunkNodeId: string;
  currentViewingNodeId: string;
}
```

### 10.2 获取节点详情

```http
GET /api/topology/nodes/:nodeId/detail
```

返回：

```ts
interface TopologyNodeDetail {
  node: TopologyNode;
  document?: DocumentMeta;
  structuredResult?: StructuredResult;
  captableVersion?: CapTableVersion;
  relatedNodes: TopologyNode[];
  availableActions: string[];
}
```

### 10.3 上传文件后触发拓扑更新

```http
POST /api/cases/:caseId/files
```

文件上传完成后，后端应异步执行：

```text
parse file
classify file
review evidence
generate structured result
update topology
generate captable version if needed
notify frontend
```

### 10.4 合并草案

```http
POST /api/topology/nodes/:nodeId/merge
```

### 10.5 否决草案

```http
POST /api/topology/nodes/:nodeId/reject
```

### 10.6 归档节点

```http
POST /api/topology/nodes/:nodeId/archive
```

### 10.7 回溯查看版本

```http
POST /api/cases/:caseId/viewing-version
```

请求：

```json
{
  "nodeId": "string"
}
```

## 11. 实现注意事项

- 拓扑模块不要直接解析文件。
- 拓扑模块只消费文件模块和数据处理模块产出的结构化结果。
- 拓扑节点不要保存完整文件内容或大段结构化 JSON。
- 每个拓扑节点必须能通过 `entityId` 查询到真实业务数据。
- 文件上传后应自动触发拓扑更新。
- 处理中的文件应有 `processing` 节点状态。
- 草案合并时应生成新的主干节点。
- 否决、归档不应删除历史节点。
- 回溯只切换查看版本，不修改当前主干。
- 右侧详情 portal 应展示人类易读内容，而不是直接展示 JSON。
- 所有 Cap Table 字段都应保留数据来源。
- 涉及合并、否决、归档、删除的操作都应记录操作日志。
- 删除文件时，需要同步删除结构化结果、缓存和向量索引。
- 如果后续支持多人协作，需要增加权限、审批流和审计日志。

## 12. 总结

拓扑模块的核心价值不是画图，而是把交易文件、草案、Cap Table 版本和审批状态组织成一个可追溯、可解释、可回滚的结构系统。

它应自动响应文件上传和数据处理结果，将已敲定文件组织为主干，将草案文件组织为分支，将合并、否决、归档和回溯作为显式生命周期操作。

每个拓扑节点都必须连接真实数据库实体，使用户能够从图上的一个节点进入对应文件、结构化结果、证据来源、AI 分析解释和 Cap Table 影响说明。这样拓扑图才能成为产品的核心业务入口，而不是一个静态的可视化装饰。
