# VeriCap

VeriCap is an AI-assisted cap table audit workbench for startup financing diligence. It helps legal and finance teams upload venture financing documents, extract equity-related evidence, reconstruct a working cap table, and review inconsistencies through an evidence-backed topology view.

The current prototype includes:

- A React/Vite frontend workbench
- A FastAPI local backend
- A DOCX processing pipeline
- A SQLite-backed workspace store
- Demo data and processed sample outputs
- Optional Gemini-powered extraction through `LLM_API_KEY`

## What VeriCap Does

VeriCap is designed for startup financing lawyers, paralegals, founders, and finance operators who need to verify whether a company's cap table is supported by its legal documents.

Core workflow:

1. Upload DOCX transaction documents.
2. Extract dates, parties, financing terms, rights, risks, and cap table signals.
3. Convert extracted evidence into structured document records.
4. Generate or update a topology graph that tracks finalized documents, drafts, branches, rejected items, merged nodes, and cap table versions.
5. Review the current working cap table and trace each result back to source evidence.

VeriCap is an audit copilot. It does not provide final legal conclusions or replace attorney review.

## Repository Structure

```text
.
├── data_process/           # Uploaded or source DOCX files
├── frontend/               # React + Vite frontend
├── idea_setup/             # Product idea notes
├── processed_data/         # Extracted JSON, index, and SQLite database
├── product-design/         # Product design documents
├── scripts/                # FastAPI server, DOCX processor, SQLite store
├── test_doc/               # Sample DOCX files for testing
├── tool/                   # Supporting generation/extraction tools
├── topology.md             # Topology module technical design
└── requirements.txt        # Python dependencies
```

## Prerequisites

Install the following before running the project:

- Python 3.10+
- Node.js 18+
- npm

Optional:

- A Gemini API key if you want LLM-based extraction. Without it, the system still runs with local extraction fallbacks and demo data.

## Environment Setup

Create a local `.env` file in the repository root if you want LLM extraction:

```bash
LLM_API_KEY=your_api_key_here
LLM_MODEL_NAME=gemini-3-flash-preview
```

If `LLM_API_KEY` is missing, the backend will fall back to deterministic local extraction for uploads and chat responses.

## Backend Setup

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

Start the FastAPI backend:

```bash
uvicorn scripts.api_server:app --reload --host 127.0.0.1 --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/api/health
```

Expected response:

```json
{"status":"ok"}
```

## Frontend Setup

Open a second terminal and run:

```bash
cd frontend
npm install
npm run dev
```

The Vite app will usually run at:

```text
http://localhost:5173
```

The frontend reads the backend from `http://127.0.0.1:8000` by default. To use a different backend URL, create `frontend/.env.local`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## How To Use The App

1. Start the backend.
2. Start the frontend.
3. Open the Vite URL in your browser.
4. Use the `Dashboard` tab to review the current workspace, topology graph, evidence state, and working cap table.
5. Use the `Document Intake` tab to upload one or more `.docx` transaction documents.
6. Click `Save and process`.
7. After processing, return to the dashboard to review:
   - Uploaded document records
   - Extracted evidence
   - Topology updates
   - Working cap table versions
   - Merge, reject, archive, and view actions for topology nodes

Only `.docx` files are currently supported by the upload flow.

## Processing Existing Documents

The repository already includes sample documents in `data_process/` and `test_doc/`.

To process all files in `data_process/` without LLM calls:

```bash
python3 scripts/process_docx_data.py --input data_process --output processed_data
```

To process one file:

```bash
python3 scripts/process_docx_data.py --file "test_doc/Series A Stock Purchase Agreement .docx" --output processed_data
```

To use Gemini extraction:

```bash
python3 scripts/process_docx_data.py --input data_process --output processed_data --llm
```

Processed outputs are written to `processed_data/` as JSON files, with an `index.json` summary.

## API Endpoints

Useful local endpoints:

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
POST /api/cases/{case_id}/chat
```

The default case ID is:

```text
case-default
```

## Development Commands

Frontend:

```bash
cd frontend
npm run dev
npm run build
npm run lint
npm run preview
```

Backend:

```bash
uvicorn scripts.api_server:app --reload --host 127.0.0.1 --port 8000
python3 scripts/process_docx_data.py --input data_process --output processed_data
```

## Data Notes

- Uploaded DOCX files are saved into `data_process/`.
- Structured extraction results are saved into `processed_data/`.
- The SQLite workbench database is stored at `processed_data/vericap.sqlite3`.
- If the backend is unavailable, the frontend falls back to bundled demo data.

## Current Limitations

- Uploads support `.docx` only.
- The cap table is a working audit view, not a final legal determination.
- LLM extraction depends on the configured model and API key.
- Complex securities, multi-jurisdiction legal rules, and final legal opinions are outside the current prototype scope.
