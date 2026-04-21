# VeriCap

VeriCap 是一个面向创业公司融资尽调场景的 AI 辅助 cap table 审计工作台。它帮助法律和财务团队上传融资文件，抽取股权相关证据，重建 working cap table，并通过可追溯的证据链和版本关系来复核不一致问题。

当前原型包含：

- React / Vite 前端工作台
- FastAPI 本地后端
- DOCX 处理流水线
- SQLite 工作台存储
- 样例数据与已处理结果
- 通过 `LLM_API_KEY` 启用的可选 LLM 抽取能力

## VeriCap 做什么

VeriCap 面向融资律师、律师助理、创始人和财务运营人员，帮助他们判断公司的 cap table 是否能够被法律文件支持。

核心流程如下：

1. 上传融资交易文件。
2. 抽取日期、主体、融资条款、权利、风险和 cap table 相关信号。
3. 将抽取结果整理为结构化文档记录和证据记录。
4. 生成或更新 topology 结构，用于表达定稿、草稿、分支、驳回、合并和版本关系。
5. 在工作台中复核当前 working cap table，并将关键结果追溯到来源证据。

VeriCap 是审计辅助工具，不提供最终法律结论，也不能替代律师复核。

## 仓库结构

```text
.
├── backend/                # FastAPI 后端、DOCX 处理流程、SQLite 存储、Python 依赖
├── data/                   # 输入样例文件和上传源文件
├── docs/                   # 产品、技术和架构文档
├── frontend/               # React + Vite 前端工作台
├── scripts/                # 一次性辅助脚本
├── storage/                # 处理后的 JSON、索引、SQLite 和导出产物
├── tests/                  # 自动化测试
├── tool/                   # 辅助生成与提取工具
└── topology.md             # 拓扑模块技术设计文档
```

## 运行前准备

运行项目之前，请先安装：

- Python 3.10+
- Node.js 18+
- npm

可选：

- 如果需要启用 LLM 抽取，请准备可用的 `LLM_API_KEY`。如果未配置，系统会回退到本地规则抽取和演示数据。

## 环境变量

如果需要启用环境变量配置，可在仓库根目录创建一个统一的 `.env` 文件：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
LLM_API_KEY=your_api_key_here
LLM_MODEL_NAME=gemini-3-flash-preview
```

- 前端会从主目录 `.env` 读取 `VITE_API_BASE_URL`。
- 后端会从主目录 `.env` 读取 `LLM_API_KEY` 和 `LLM_MODEL_NAME`。
- 如果没有提供 `LLM_API_KEY`，后端会在上传处理和聊天解释中回退到本地确定性逻辑。

## 后端启动

在仓库根目录执行：

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r backend/requirements.txt
```

启动 FastAPI 后端：

```bash
uvicorn backend.api_server:app --reload --host 127.0.0.1 --port 8000
```

健康检查：

```bash
curl http://127.0.0.1:8000/api/health
```

预期返回：

```json
{"status":"ok"}
```

## 前端启动

打开第二个终端并执行：

```bash
cd frontend
npm install
npm run dev
```

Vite 默认通常运行在：

```text
http://localhost:5173
```

前端默认读取主目录 `.env` 中的 `VITE_API_BASE_URL` 作为后端地址。如果要改成其他地址，请修改主目录 `.env`：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## 如何使用

1. 启动后端。
2. 启动前端。
3. 在浏览器打开 Vite 地址。
4. 进入工作台页面。
5. 在左侧或文件区域上传一个或多个融资文件。
6. 等待系统完成处理后，在工作台中查看：
   - 上传文件和文件状态
   - 抽取出来的证据内容
   - topology 和版本关系
   - 当前 working cap table
   - 节点的 merge、reject、archive、view 等操作

当前上传链路仍以 `.docx` 文件为主。

## 处理已有样例文件

仓库已经在 `data/` 中提供了样例文件。

如果希望在不调用 LLM 的情况下处理 `data/` 中所有文件：

```bash
python3 backend/process_docx_data.py --input data --output storage
```

如果只处理单个文件：

```bash
python3 backend/process_docx_data.py --file "data/Series A Stock Purchase Agreement .docx" --output storage
```

如果希望启用 LLM 抽取：

```bash
python3 backend/process_docx_data.py --input data --output storage --llm
```

处理结果会写入 `storage/`，并生成 `index.json` 汇总文件。

## API 接口

当前本地可用的主要接口如下：

```text
GET  /api/health
GET  /api/documents
GET  /api/workbench
GET  /api/cases/{case_id}/topology
GET  /api/topology/nodes/{node_id}/detail
POST /api/cases/{case_id}/files
POST /api/topology/nodes/{node_id}/merge
POST /api/topology/nodes/{node_id}/reject
POST /api/topology/nodes/{node_id}/archive
POST /api/cases/{case_id}/viewing-version
POST /api/process
```

默认 case ID 为：

```text
case-default
```

## 常用开发命令

前端：

```bash
cd frontend
npm run dev
npm run build
npm run lint
npm run preview
```

后端：

```bash
uvicorn backend.api_server:app --reload --host 127.0.0.1 --port 8000
python3 backend/process_docx_data.py --input data --output storage
```

## 数据说明

- 上传或样例 DOCX 文件保存在 `data/`。
- 结构化抽取结果保存在 `storage/`。
- SQLite 工作台数据库位于 `storage/vericap.sqlite3`。
- 如果后端不可用，前端会回退到内置演示数据。
- 用户上传文件的运行时产物位于 `storage/uploads/`、`storage/parsed/`、`storage/candidates/` 和 `storage/*.json`，这些目录应与样例 `data/` 分离管理。

## 删除与保留

- 当前工作台删除采用硬删除。
- 文件夹级删除会永久删除该文件夹下的上传原件、结构化结果、working cap table 派生数据和当前 case 聊天上下文。
- case 级删除会永久删除整个工作台的数据库记录与相关运行时文件。
- 删除审计只保留最小元数据，例如删除范围、删除数量、时间和状态，不保留被删文件正文或聊天正文。

## 当前限制

- 上传链路主要支持 `.docx`。
- cap table 结果是 working audit view，不是最终法律结论。
- LLM 抽取能力依赖模型配置和 API Key。
- 复杂证券设计、多法域分析和最终法律意见不在当前原型范围内。
