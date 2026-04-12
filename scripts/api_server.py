#!/usr/bin/env python3
"""Local API for document upload and preprocessing pipeline."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from process_docx_data import (
    DEFAULT_INPUT_DIR,
    DEFAULT_MODEL,
    DEFAULT_OUTPUT_DIR,
    DEFAULT_TASKS,
    build_index,
    iter_input_files,
    load_dotenv_if_available,
    process_file,
    safe_stem,
    write_json,
)


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


def pipeline_model_name() -> str:
    import os

    load_dotenv_if_available()
    return os.getenv("LLM_MODEL_NAME", DEFAULT_MODEL)


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


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/documents")
def list_documents() -> dict:
    DEFAULT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    index_path = DEFAULT_OUTPUT_DIR / "index.json"
    if not index_path.exists():
        return refresh_index()

    import json

    return json.loads(index_path.read_text(encoding="utf-8"))


@app.post("/api/documents")
def upload_documents(
    files: Annotated[list[UploadFile], File()],
    use_llm: Annotated[bool, Form()] = False,
    task: Annotated[list[str] | None, Form()] = None,
) -> JSONResponse:
    DEFAULT_INPUT_DIR.mkdir(parents=True, exist_ok=True)
    DEFAULT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    tasks = DEFAULT_TASKS if not task or "all" in task else task
    invalid_tasks = sorted(set(tasks) - set(DEFAULT_TASKS))
    if invalid_tasks:
        raise HTTPException(status_code=400, detail=f"Invalid task(s): {', '.join(invalid_tasks)}")

    processed = []
    failures = []

    for upload in files:
        original_name = Path(upload.filename or "").name
        if not original_name:
            failures.append({"source_file": "", "error": "Missing filename"})
            continue
        if not original_name.lower().endswith(".docx"):
            failures.append({"source_file": original_name, "error": "Only .docx files are supported"})
            continue

        destination = unique_destination(DEFAULT_INPUT_DIR / original_name)
        try:
            with destination.open("wb") as target:
                shutil.copyfileobj(upload.file, target)
            result = process_file(
                path=destination,
                output_dir=DEFAULT_OUTPUT_DIR,
                use_llm=use_llm,
                model=pipeline_model_name(),
                max_chars=18000,
                tasks=tasks,
            )
            processed.append(
                {
                    "source_file": destination.name,
                    "status": result.get("processing_metadata", {}).get("status", "processed"),
                    "output_file": f"{safe_stem(destination)}.json",
                }
            )
        except Exception as exc:  # noqa: BLE001 - report per-file failures to the UI.
            failures.append({"source_file": original_name, "error": str(exc)})
        finally:
            upload.file.close()

    index = refresh_index()
    status_code = 207 if failures and processed else 400 if failures else 200
    return JSONResponse(
        status_code=status_code,
        content={
            "processed": processed,
            "failures": failures,
            "index": index,
        },
    )


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
