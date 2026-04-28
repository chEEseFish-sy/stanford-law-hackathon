#!/usr/bin/env python3
"""Local API for document upload and preprocessing pipeline."""

from __future__ import annotations

import json
import shutil
import sys
import os
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

try:
    from .process_docx_data import (
        DEFAULT_INPUT_DIR,
        DEFAULT_MODEL,
        DEFAULT_OUTPUT_DIR,
        DEFAULT_TASKS,
        DeepSeekExtractor,
        build_index,
        iter_input_files,
        load_dotenv_if_available,
        process_file,
        safe_stem,
        write_json,
    )
    from .workbench_store import (
        DEFAULT_CASE_ID,
        append_case_message,
        build_index_from_db,
        list_case_messages,
        build_workbench_snapshot,
        delete_case,
        get_document_record,
        get_node_detail,
        ingest_processed_result,
        init_store,
        merge_node,
        remove_folder,
        set_viewing_version,
        update_node_status,
    )
except ImportError:
    from process_docx_data import (
        DEFAULT_INPUT_DIR,
        DEFAULT_MODEL,
        DEFAULT_OUTPUT_DIR,
        DEFAULT_TASKS,
        DeepSeekExtractor,
        build_index,
        iter_input_files,
        load_dotenv_if_available,
        process_file,
        safe_stem,
        write_json,
    )
    from workbench_store import (
        DEFAULT_CASE_ID,
        append_case_message,
        build_index_from_db,
        list_case_messages,
        build_workbench_snapshot,
        delete_case,
        get_document_record,
        get_node_detail,
        ingest_processed_result,
        init_store,
        merge_node,
        remove_folder,
        set_viewing_version,
        update_node_status,
    )

ROOT_DIR = SCRIPT_DIR.parent
DEFAULT_INPUT_DIR = (ROOT_DIR / DEFAULT_INPUT_DIR).resolve() if not DEFAULT_INPUT_DIR.is_absolute() else DEFAULT_INPUT_DIR
DEFAULT_OUTPUT_DIR = (ROOT_DIR / DEFAULT_OUTPUT_DIR).resolve() if not DEFAULT_OUTPUT_DIR.is_absolute() else DEFAULT_OUTPUT_DIR
UPLOAD_INPUT_DIR = DEFAULT_OUTPUT_DIR / "uploads"


app = FastAPI(title="Document Processing Pipeline")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_store()


class ChatRequest(BaseModel):
    message: str
    llmApiKey: str | None = None
    llmModelName: str | None = None


class FolderRemoveRequest(BaseModel):
    folderPath: str


class CaseDeleteRequest(BaseModel):
    confirmText: str


def pipeline_model_name() -> str:
    load_dotenv_if_available()
    return os.getenv("DEEPSEEK_MODEL_NAME", os.getenv("LLM_MODEL_NAME", DEFAULT_MODEL))


def llm_api_key() -> str:
    load_dotenv_if_available()
    return os.getenv("DEEPSEEK_API_KEY", os.getenv("LLM_API_KEY", "")).strip()


def resolve_model_name(override: str | None = None) -> str:
    candidate = (override or "").strip()
    return candidate or pipeline_model_name()


def resolve_api_key(override: str | None = None) -> str:
    candidate = (override or "").strip()
    return candidate or llm_api_key()


def build_case_chat_prompt(case_id: str, message: str) -> str:
    snapshot = build_workbench_snapshot(case_id)
    recent_messages = list_case_messages(case_id)[-6:]
    prompt_context = {
        "workspace": snapshot["workspace"],
        "documents": [
            {
                "fileName": document["fileName"],
                "fileType": document["fileType"],
                "transactionDate": document.get("transactionDate"),
                "evidenceStatus": document["evidenceStatus"],
                "summary": document["summary"],
            }
            for document in snapshot["documents"][-8:]
        ],
        "captableVersions": [
            {
                "versionName": version["versionName"],
                "status": version["status"],
                "summary": version["summary"],
                "rows": version["rows"][:8],
            }
            for version in snapshot["captableVersions"][-3:]
        ],
        "operationLogs": snapshot["operationLogs"][:8],
        "recentMessages": recent_messages,
    }

    return f"""
You are VeriCap AI, an internal workspace copilot for financing document review.
Answer based only on the workspace context below.
If the context is insufficient, say that clearly and ask the user to upload or open the needed file.
Be concise, practical, and avoid legal claims of certainty.

Workspace context:
{json.dumps(prompt_context, ensure_ascii=False, indent=2)}

User message:
{message.strip()}
""".strip()


def generate_case_chat_reply(case_id: str, message: str, api_key_override: str | None = None, model_name_override: str | None = None) -> str:
    api_key = resolve_api_key(api_key_override)
    if not api_key:
        raise RuntimeError("LLM API key is missing. Add it in workspace settings or configure the backend environment.")
    extractor = DeepSeekExtractor(api_key=api_key, model=resolve_model_name(model_name_override))
    return extractor.generate_text(build_case_chat_prompt(case_id, message))


def refresh_index() -> dict:
    results = []
    for output_file in sorted(DEFAULT_OUTPUT_DIR.glob("*.json")):
        if output_file.name == "index.json":
            continue
        try:
            import json

            results.append(json.loads(output_file.read_text(encoding="utf-8")))
        except Exception:
            continue
    index = build_index(results)
    write_json(DEFAULT_OUTPUT_DIR / "index.json", index)
    return index


def build_system_status() -> dict:
    default_snapshot = build_workbench_snapshot(DEFAULT_CASE_ID)
    has_demo_documents = len(default_snapshot["documents"]) > 0
    has_demo_versions = len(default_snapshot["captableVersions"]) > 0

    return {
        "api": {
            "status": "ok",
        },
        "workspace": {
            "defaultCaseId": DEFAULT_CASE_ID,
            "defaultCaseAvailable": has_demo_documents,
            "defaultCaseName": default_snapshot["workspace"]["caseName"],
        },
        "llm": {
            "configured": bool(llm_api_key()),
            "modelName": pipeline_model_name(),
        },
        "mode": {
            "demoDataAvailable": has_demo_documents or has_demo_versions,
            "storage": "local",
        },
    }


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/system-status")
def system_status() -> dict:
    return build_system_status()


@app.get("/api/documents")
def list_documents() -> dict:
    DEFAULT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    return build_index_from_db(DEFAULT_CASE_ID)


@app.get("/api/workbench")
def get_workbench(case_id: str = DEFAULT_CASE_ID) -> dict:
    return build_workbench_snapshot(case_id)


@app.get("/api/cases/{case_id}/documents/{document_id}/download")
def download_case_document(case_id: str, document_id: str) -> FileResponse:
    try:
        document = get_document_record(case_id, document_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Document {document_id} not found") from exc

    source_path = Path(document["sourcePath"])
    if not source_path.exists() or not source_path.is_file():
        raise HTTPException(status_code=404, detail=f"Source file for document {document_id} is missing")

    return FileResponse(
        path=source_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=document["fileName"],
    )


@app.get("/api/cases/{case_id}/topology")
def get_case_topology(case_id: str) -> dict:
    return build_workbench_snapshot(case_id)["topology"]


@app.get("/api/topology/nodes/{node_id}/detail")
def get_topology_node_detail(node_id: str) -> dict:
    try:
        return get_node_detail(node_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found") from exc


@app.post("/api/topology/nodes/{node_id}/merge")
def merge_topology_node(node_id: str) -> dict:
    try:
        return merge_node(node_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found") from exc


@app.post("/api/topology/nodes/{node_id}/reject")
def reject_topology_node(node_id: str) -> dict:
    try:
        return update_node_status(node_id, "rejected", "reject")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found") from exc


@app.post("/api/topology/nodes/{node_id}/archive")
def archive_topology_node(node_id: str) -> dict:
    try:
        return update_node_status(node_id, "archived", "archive")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found") from exc


@app.post("/api/cases/{case_id}/viewing-version")
def switch_viewing_version(case_id: str, node_id: Annotated[str, Form()]) -> dict:
    try:
        return set_viewing_version(case_id, node_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found") from exc


@app.post("/api/cases/{case_id}/files")
def upload_case_files(
    case_id: str,
    files: Annotated[list[UploadFile], File()],
    file_paths: Annotated[str | None, Form()] = None,
    use_llm: Annotated[bool, Form()] = False,
    llm_api_key: Annotated[str | None, Form()] = None,
    llm_model_name: Annotated[str | None, Form()] = None,
    task: Annotated[list[str] | None, Form()] = None,
) -> JSONResponse:
    return process_uploads(case_id, files, file_paths, use_llm, llm_api_key, llm_model_name, task)


@app.post("/api/cases/{case_id}/folders/remove")
def remove_case_folder(case_id: str, payload: FolderRemoveRequest) -> dict:
    try:
        result = remove_folder(case_id, payload.folderPath)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Folder {payload.folderPath} not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return result


@app.post("/api/cases/{case_id}/delete")
def delete_case_route(case_id: str, payload: CaseDeleteRequest) -> dict:
    if payload.confirmText.strip().upper() != "DELETE":
        raise HTTPException(status_code=400, detail="Confirmation text must be DELETE")

    try:
        return delete_case(case_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/cases/{case_id}/chat")
def chat_case(case_id: str, payload: ChatRequest) -> dict:
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        reply = generate_case_chat_reply(case_id, message, payload.llmApiKey, payload.llmModelName)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to generate chat response: {exc}") from exc

    append_case_message(case_id, "user", message)
    assistant_message = append_case_message(case_id, "assistant", reply)
    return {
        "reply": assistant_message,
        "messages": list_case_messages(case_id),
    }


@app.get("/api/documents-legacy")
def list_documents_legacy() -> dict:
    DEFAULT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    index_path = DEFAULT_OUTPUT_DIR / "index.json"
    if not index_path.exists():
        return refresh_index()

    import json

    return json.loads(index_path.read_text(encoding="utf-8"))


@app.post("/api/documents")
def upload_documents(
    files: Annotated[list[UploadFile], File()],
    file_paths: Annotated[str | None, Form()] = None,
    use_llm: Annotated[bool, Form()] = False,
    llm_api_key: Annotated[str | None, Form()] = None,
    llm_model_name: Annotated[str | None, Form()] = None,
    task: Annotated[list[str] | None, Form()] = None,
) -> JSONResponse:
    return process_uploads(DEFAULT_CASE_ID, files, file_paths, use_llm, llm_api_key, llm_model_name, task)


def process_uploads(
    case_id: str,
    files: list[UploadFile],
    file_paths: str | None,
    use_llm: bool,
    llm_api_key_override: str | None,
    llm_model_name_override: str | None,
    task: list[str] | None,
) -> JSONResponse:
    UPLOAD_INPUT_DIR.mkdir(parents=True, exist_ok=True)
    DEFAULT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    tasks = DEFAULT_TASKS if not task or "all" in task else task
    invalid_tasks = sorted(set(tasks) - set(DEFAULT_TASKS))
    if invalid_tasks:
        raise HTTPException(status_code=400, detail=f"Invalid task(s): {', '.join(invalid_tasks)}")

    processed = []
    failures = []
    topology_updates = []
    relative_paths = parse_file_paths_metadata(file_paths, len(files))
    effective_api_key = resolve_api_key(llm_api_key_override)
    effective_model_name = resolve_model_name(llm_model_name_override)
    enable_llm = use_llm and bool(effective_api_key)

    for index, upload in enumerate(files):
        original_name = Path(upload.filename or "").name
        relative_path = relative_paths[index] if index < len(relative_paths) else None
        if not original_name:
            failures.append({"source_file": "", "error": "Missing filename"})
            continue
        if not original_name.lower().endswith(".docx"):
            failures.append({"source_file": original_name, "error": "Only .docx files are supported"})
            continue

        destination = stable_upload_destination(case_id, original_name, relative_path)
        try:
            with destination.open("wb") as target:
                shutil.copyfileobj(upload.file, target)
            result = process_file(
                path=destination,
                output_dir=DEFAULT_OUTPUT_DIR,
                use_llm=enable_llm,
                model=effective_model_name,
                max_chars=18000,
                tasks=tasks,
                api_key=effective_api_key if enable_llm else None,
            )
            result["source_file"] = original_name
            processed.append(
                {
                    "source_file": original_name,
                    "status": result.get("processing_metadata", {}).get("status", "processed"),
                    "output_file": f"{safe_stem(destination)}.json",
                }
            )
            topology_updates.append(
                ingest_processed_result(
                    case_id=case_id,
                    result=result,
                    source_path=str(destination),
                    relative_path=relative_path,
                )
            )
        except Exception as exc:  # noqa: BLE001 - report per-file failures to the UI.
            failures.append({"source_file": original_name, "error": str(exc)})
        finally:
            upload.file.close()

    index = refresh_index()
    status_code = 207 if failures and processed else 400 if failures else 200
    workbench = build_workbench_snapshot(case_id)
    return JSONResponse(
        status_code=status_code,
        content={
            "processed": processed,
            "failures": failures,
            "index": index,
            "topology_updates": topology_updates,
            "workbench": workbench,
        },
    )


def parse_file_paths_metadata(file_paths: str | None, file_count: int) -> list[str | None]:
    if not file_paths:
        return [None] * file_count

    try:
        payload = json.loads(file_paths)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid file path metadata") from exc

    if not isinstance(payload, list) or len(payload) != file_count:
        raise HTTPException(status_code=400, detail="File path metadata does not match uploaded files")

    relative_paths: list[str | None] = []
    for item in payload:
        if item is None:
            relative_paths.append(None)
            continue
        if isinstance(item, dict):
            candidate = item.get("relativePath")
            relative_paths.append(str(candidate) if candidate else None)
            continue
        if isinstance(item, str):
            relative_paths.append(item)
            continue
        raise HTTPException(status_code=400, detail="Unsupported file path metadata entry")
    return relative_paths


def stable_upload_destination(case_id: str, original_name: str, relative_path: str | None = None) -> Path:
    source_hint = relative_path or original_name
    source_stem = safe_stem(Path(source_hint))
    case_stem = safe_stem(Path(case_id))
    token = uuid4().hex[:8]
    destination = UPLOAD_INPUT_DIR / f"{case_stem}__{source_stem}__{token}{Path(original_name).suffix.lower()}"
    destination.parent.mkdir(parents=True, exist_ok=True)
    return unique_destination(destination)


def unique_destination(path: Path) -> Path:
    if not path.exists():
        return path

    counter = 1
    while True:
        candidate = path.with_name(f"{path.stem}_{counter}{path.suffix}")
        if not candidate.exists():
            return candidate
        counter += 1


@app.post("/api/process")
def process_existing_documents(
    use_llm: Annotated[bool, Form()] = False,
    task: Annotated[list[str] | None, Form()] = None,
) -> dict:
    tasks = DEFAULT_TASKS if not task or "all" in task else task
    results = []
    failures = []

    for path in iter_input_files(DEFAULT_INPUT_DIR, None):
        try:
            results.append(
                process_file(
                    path=path,
                    output_dir=DEFAULT_OUTPUT_DIR,
                    use_llm=use_llm,
                    model=pipeline_model_name(),
                    max_chars=18000,
                    tasks=tasks,
                )
            )
        except Exception as exc:  # noqa: BLE001
            failures.append({"source_file": str(path), "error": str(exc)})

    index = build_index(results)
    if failures:
        index["failures"] = failures
    write_json(DEFAULT_OUTPUT_DIR / "index.json", index)
    return index
