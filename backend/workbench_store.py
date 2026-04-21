#!/usr/bin/env python3
"""SQLite-backed VeriCap workbench store."""

from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

try:
    from .process_docx_data import safe_stem
except ImportError:
    from process_docx_data import safe_stem


DEFAULT_CASE_ID = "case-default"
ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_INPUT_DIR = ROOT_DIR / "data"
DEFAULT_OUTPUT_DIR = ROOT_DIR / "storage"
DB_PATH = DEFAULT_OUTPUT_DIR / "vericap.sqlite3"
MIN_CAPTABLE_SHARE_COUNT = 1_000
ROOT_FOLDER_NAME = "Root"
DELETION_STATUS_PENDING = "pending"
DELETION_STATUS_COMPLETED = "completed"
DELETION_STATUS_FAILED = "failed"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_store() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS cases (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              current_trunk_node_id TEXT,
              current_viewing_node_id TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS files (
              id TEXT PRIMARY KEY,
              case_id TEXT NOT NULL REFERENCES cases(id),
              file_name TEXT NOT NULL,
              file_type TEXT NOT NULL,
              transaction_date TEXT,
              uploaded_at TEXT NOT NULL,
              source_path TEXT NOT NULL,
              storage_provider TEXT NOT NULL,
              processing_status TEXT NOT NULL,
              evidence_status TEXT NOT NULL,
              summary TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS structured_results (
              id TEXT PRIMARY KEY,
              case_id TEXT NOT NULL REFERENCES cases(id),
              document_id TEXT NOT NULL REFERENCES files(id),
              transaction_type TEXT NOT NULL,
              parties_json TEXT NOT NULL,
              effective_date TEXT,
              captable_impact_summary TEXT NOT NULL,
              extracted_terms_json TEXT NOT NULL,
              evidence_findings_json TEXT NOT NULL,
              ai_explanation TEXT NOT NULL,
              raw_json TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS topology_nodes (
              id TEXT PRIMARY KEY,
              case_id TEXT NOT NULL REFERENCES cases(id),
              parent_id TEXT,
              refs_json TEXT NOT NULL,
              depth INTEGER NOT NULL,
              node_index INTEGER NOT NULL,
              label TEXT NOT NULL,
              status TEXT NOT NULL,
              node_type TEXT NOT NULL,
              entity_id TEXT NOT NULL,
              entity_type TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS topology_refs (
              id TEXT PRIMARY KEY,
              case_id TEXT NOT NULL REFERENCES cases(id),
              from_node_id TEXT NOT NULL,
              to_node_id TEXT NOT NULL,
              ref_type TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS captable_versions (
              id TEXT PRIMARY KEY,
              case_id TEXT NOT NULL REFERENCES cases(id),
              topology_node_id TEXT NOT NULL REFERENCES topology_nodes(id),
              parent_version_id TEXT,
              version_name TEXT NOT NULL,
              generated_from_document_ids_json TEXT NOT NULL,
              status TEXT NOT NULL,
              summary TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS captable_rows (
              id TEXT PRIMARY KEY,
              version_id TEXT NOT NULL REFERENCES captable_versions(id) ON DELETE CASCADE,
              holder_name TEXT NOT NULL,
              security_type TEXT NOT NULL,
              shares REAL NOT NULL,
              ownership_percentage REAL NOT NULL,
              source_document_id TEXT NOT NULL,
              source_location TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS operation_logs (
              id TEXT PRIMARY KEY,
              case_id TEXT NOT NULL REFERENCES cases(id),
              action TEXT NOT NULL,
              node_id TEXT NOT NULL,
              description TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS case_messages (
              id TEXT PRIMARY KEY,
              case_id TEXT NOT NULL REFERENCES cases(id),
              role TEXT NOT NULL,
              content TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS deletion_events (
              id TEXT PRIMARY KEY,
              scope_type TEXT NOT NULL,
              case_id TEXT NOT NULL,
              scope_ref TEXT NOT NULL,
              removed_file_count INTEGER NOT NULL,
              removed_structured_result_count INTEGER NOT NULL,
              removed_captable_version_count INTEGER NOT NULL,
              removed_message_count INTEGER NOT NULL,
              status TEXT NOT NULL,
              requested_at TEXT NOT NULL,
              completed_at TEXT,
              error_message TEXT
            );
            """
        )
        ensure_column(conn, "files", "relative_path", "TEXT")
        ensure_column(conn, "files", "artifact_paths_json", "TEXT")

    seed_if_empty()
    rebuild_generated_captables()


def seed_if_empty() -> None:
    with connect() as conn:
        count = conn.execute("SELECT COUNT(*) AS count FROM cases").fetchone()["count"]
    if count:
        return

    create_case(DEFAULT_CASE_ID, "Default financing audit")


def create_case(case_id: str, name: str) -> None:
    now = utc_now()
    with connect() as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO cases
            (id, name, current_trunk_node_id, current_viewing_node_id, created_at, updated_at)
            VALUES (?, ?, NULL, NULL, ?, ?)
            """,
            (case_id, name, now, now),
        )


def case_exists(case_id: str) -> bool:
    with connect() as conn:
        row = conn.execute("SELECT 1 FROM cases WHERE id = ?", (case_id,)).fetchone()
    return row is not None


def ingest_processed_result(
    case_id: str,
    result: dict[str, Any],
    source_path: str,
    relative_path: str | None = None,
    stable_id: str | None = None,
) -> dict[str, Any]:
    create_case(case_id, "Default financing audit")
    now = utc_now()
    source_file = str(result.get("source_file") or Path(source_path).name)
    document_id = unique_id(stable_id or f"file-{safe_stem(Path(source_file))}")
    document_title = str(result.get("document_title") or source_file)
    file_type = classify_file(source_file, document_title)
    processing_status = map_processing_status(result)
    evidence_status = infer_evidence_status(result, file_type)
    transaction_date = infer_transaction_date(result)
    summary = build_document_summary(result, document_title, file_type)
    artifact_paths = document_artifact_paths(source_path)

    with connect() as conn:
        conn.execute(
            """
            INSERT INTO files
            (id, case_id, file_name, file_type, transaction_date, uploaded_at, source_path,
             relative_path, artifact_paths_json, storage_provider, processing_status, evidence_status, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', ?, ?, ?)
            """,
            (
                document_id,
                case_id,
                source_file,
                file_type,
                transaction_date,
                now,
                source_path,
                normalize_relative_path(relative_path),
                json.dumps([str(path) for path in artifact_paths], ensure_ascii=False),
                processing_status,
                evidence_status,
                summary,
            ),
        )
        structured_id = f"result-{document_id.removeprefix('file-')}"
        conn.execute(
            """
            INSERT INTO structured_results
            (id, case_id, document_id, transaction_type, parties_json, effective_date,
             captable_impact_summary, extracted_terms_json, evidence_findings_json,
             ai_explanation, raw_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                structured_id,
                case_id,
                document_id,
                infer_transaction_type(result, file_type),
                json.dumps(normalize_parties(result), ensure_ascii=False),
                transaction_date,
                build_impact_summary(result, file_type),
                json.dumps(build_extracted_terms(result), ensure_ascii=False),
                json.dumps(build_evidence_findings(result), ensure_ascii=False),
                build_ai_explanation(result, file_type),
                json.dumps(result, ensure_ascii=False),
                now,
            ),
        )

        current_trunk = get_case_field(conn, case_id, "current_trunk_node_id")
        parent_id = current_trunk
        parent = get_node(conn, parent_id) if parent_id else None
        depth = int(parent["depth"]) + 1 if parent else 0
        node_id = unique_id(f"node-{safe_stem(Path(source_file))}")
        node_status = "draft" if file_type == "draft_transaction" else "trunk"
        node_type = "draft_document" if file_type == "draft_transaction" else "finalized_document"
        if file_type in {"board_resolution", "side_letter", "other"}:
            node_type = "document"
        conn.execute(
            """
            INSERT INTO topology_nodes
            (id, case_id, parent_id, refs_json, depth, node_index, label, status,
             node_type, entity_id, entity_type, created_at, updated_at)
            VALUES (?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, 'file', ?, ?)
            """,
            (
                node_id,
                case_id,
                parent_id,
                depth,
                next_index(conn, case_id, depth),
                document_title,
                node_status,
                node_type,
                document_id,
                now,
                now,
            ),
        )

        if file_type in {"finalized_transaction", "board_resolution"}:
            cap_node_id, cap_version_id = create_captable_version(conn, case_id, node_id, document_title)
            conn.execute(
                "UPDATE cases SET current_trunk_node_id = ?, current_viewing_node_id = ?, updated_at = ? WHERE id = ?",
                (cap_node_id, cap_node_id, now, case_id),
            )
            target_node_id = cap_node_id
        else:
            cap_version_id = None
            target_node_id = node_id

        conn.execute(
            """
            INSERT INTO operation_logs (id, case_id, action, node_id, description, created_at)
            VALUES (?, ?, 'upload', ?, ?, ?)
            """,
            (
                unique_id("log-upload"),
                case_id,
                target_node_id,
                f"Uploaded {source_file} and updated the workbench topology.",
                now,
            ),
        )

    return {
        "document_id": document_id,
        "node_id": target_node_id,
        "captable_version_id": cap_version_id,
    }


def create_captable_version(
    conn: sqlite3.Connection,
    case_id: str,
    document_node_id: str,
    label: str,
    include_document_id: str | None = None,
) -> tuple[str, str]:
    now = utc_now()
    current_trunk = get_case_field(conn, case_id, "current_trunk_node_id")
    parent_version = current_version(conn, case_id)
    parent = get_node(conn, document_node_id)
    depth = int(parent["depth"]) + 1 if parent else 0
    cap_node_id = unique_id("node-cap")
    cap_version_id = unique_id("cap")

    conn.execute(
        """
        INSERT INTO topology_nodes
        (id, case_id, parent_id, refs_json, depth, node_index, label, status, node_type,
         entity_id, entity_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'trunk', 'captable_version', ?, 'captable', ?, ?)
        """,
        (
            cap_node_id,
            case_id,
            document_node_id if document_node_id else current_trunk,
            json.dumps([document_node_id] if document_node_id else []),
            depth,
            next_index(conn, case_id, depth),
            f"Cap table · {label}",
            cap_version_id,
            now,
            now,
        ),
    )

    if document_node_id:
        conn.execute(
            """
            INSERT INTO topology_refs (id, case_id, from_node_id, to_node_id, ref_type)
            VALUES (?, ?, ?, ?, 'derived_from')
            """,
            (unique_id("ref"), case_id, cap_node_id, document_node_id),
        )

    conn.execute("UPDATE captable_versions SET status = 'historical' WHERE case_id = ? AND status = 'current'", (case_id,))
    document_ids = generated_document_ids(conn, case_id, include_document_id)
    conn.execute(
        """
        INSERT INTO captable_versions
        (id, case_id, topology_node_id, parent_version_id, version_name,
         generated_from_document_ids_json, status, summary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'current', ?, ?)
        """,
        (
            cap_version_id,
            case_id,
            cap_node_id,
            parent_version["id"] if parent_version else None,
            f"Working version · {label}",
            json.dumps(document_ids, ensure_ascii=False),
            f"Generated from {len(document_ids)} document(s). Rows are evidence-backed demo calculations.",
            now,
        ),
    )
    write_captable_rows(conn, case_id, cap_version_id, document_ids)
    return cap_node_id, cap_version_id


def build_workbench_snapshot(case_id: str = DEFAULT_CASE_ID) -> dict[str, Any]:
    init_store()
    with connect() as conn:
        case = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
        if not case:
            create_case(case_id, "Default financing audit")
            case = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()

        documents = [document_payload(row) for row in conn.execute("SELECT * FROM files WHERE case_id = ? ORDER BY uploaded_at", (case_id,))]
        structured = [
            structured_payload(row)
            for row in conn.execute("SELECT * FROM structured_results WHERE case_id = ? ORDER BY created_at", (case_id,))
        ]
        cap_versions = [
            captable_payload(conn, row)
            for row in conn.execute("SELECT * FROM captable_versions WHERE case_id = ? ORDER BY created_at", (case_id,))
        ]
        nodes = [node_payload(row) for row in conn.execute("SELECT * FROM topology_nodes WHERE case_id = ? ORDER BY depth, node_index, created_at", (case_id,))]
        nodes = attach_children(nodes)
        refs = [
            {"fromNodeId": row["from_node_id"], "toNodeId": row["to_node_id"], "refType": row["ref_type"]}
            for row in conn.execute("SELECT * FROM topology_refs WHERE case_id = ?", (case_id,))
        ]
        logs = [
            {
                "id": row["id"],
                "action": row["action"],
                "nodeId": row["node_id"],
                "description": row["description"],
                "createdAt": row["created_at"],
            }
            for row in conn.execute("SELECT * FROM operation_logs WHERE case_id = ? ORDER BY created_at DESC LIMIT 50", (case_id,))
        ]
        messages = [
            {
                "id": row["id"],
                "role": row["role"],
                "content": row["content"],
                "createdAt": row["created_at"],
            }
            for row in conn.execute(
                "SELECT * FROM case_messages WHERE case_id = ? ORDER BY created_at, rowid",
                (case_id,),
            )
        ]

    current_trunk = case["current_trunk_node_id"] or (nodes[-1]["id"] if nodes else "")
    current_viewing = case["current_viewing_node_id"] or current_trunk
    return {
        "workspace": {
            "caseId": case["id"],
            "caseName": case["name"],
            "currentTrunkNodeId": current_trunk,
            "currentViewingNodeId": current_viewing,
        },
        "topology": {
            "nodes": nodes,
            "refs": refs,
            "currentTrunkNodeId": current_trunk,
            "currentViewingNodeId": current_viewing,
        },
        "documents": documents,
        "structuredResults": structured,
        "captableVersions": cap_versions,
        "operationLogs": logs,
        "chatMessages": messages,
        "documentPreviews": build_document_previews(structured),
        "documentComparisons": [],
    }


def get_case_file_rows(conn: sqlite3.Connection, case_id: str, folder_path: str | None = None) -> list[sqlite3.Row]:
    if folder_path is None:
        return list(conn.execute("SELECT * FROM files WHERE case_id = ? ORDER BY uploaded_at", (case_id,)))
    if folder_path == ROOT_FOLDER_NAME:
        return list(
            conn.execute(
                """
                SELECT * FROM files
                WHERE case_id = ?
                  AND (relative_path IS NULL OR relative_path = '')
                ORDER BY uploaded_at
                """,
                (case_id,),
            )
        )
    return list(
        conn.execute(
            """
            SELECT * FROM files
            WHERE case_id = ?
              AND relative_path IS NOT NULL
              AND relative_path != ''
              AND (relative_path = ? OR relative_path LIKE ?)
            ORDER BY uploaded_at
            """,
            (case_id, folder_path, f"{folder_path}/%"),
        )
    )


def collect_deletion_scope(conn: sqlite3.Connection, case_id: str, scope_type: str, scope_ref: str) -> dict[str, Any]:
    case_row = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
    if not case_row:
        raise KeyError(case_id)

    file_rows = get_case_file_rows(conn, case_id, scope_ref if scope_type == "folder" else None)
    if scope_type == "folder" and not file_rows:
        raise KeyError(scope_ref)

    document_ids = [row["id"] for row in file_rows]
    document_node_ids: list[str] = []
    if document_ids:
        placeholders = ",".join("?" for _ in document_ids)
        document_node_ids = [
            row["id"]
            for row in conn.execute(
                f"""
                SELECT id FROM topology_nodes
                WHERE case_id = ? AND entity_type = 'file' AND entity_id IN ({placeholders})
                """,
                (case_id, *document_ids),
            )
        ]

    cap_node_ids: list[str] = []
    cap_version_ids: list[str] = []
    if scope_type == "case":
        cap_rows = list(conn.execute("SELECT topology_node_id, id FROM captable_versions WHERE case_id = ?", (case_id,)))
        cap_node_ids = [row["topology_node_id"] for row in cap_rows]
        cap_version_ids = [row["id"] for row in cap_rows]
    elif document_node_ids:
        placeholders = ",".join("?" for _ in document_node_ids)
        derived_cap_rows = list(
            conn.execute(
                f"""
                SELECT id, entity_id
                FROM topology_nodes
                WHERE case_id = ?
                  AND node_type = 'captable_version'
                  AND parent_id IN ({placeholders})
                """,
                (case_id, *document_node_ids),
            )
        )
        cap_node_ids = [row["id"] for row in derived_cap_rows]
        cap_version_ids = [row["entity_id"] for row in derived_cap_rows]

    message_rows = list(conn.execute("SELECT id FROM case_messages WHERE case_id = ?", (case_id,)))
    artifact_paths = document_artifact_paths_from_rows(file_rows)
    structured_result_count = count_ids(conn, "structured_results", "document_id", case_id, document_ids)

    return {
        "case": case_row,
        "file_rows": file_rows,
        "document_ids": document_ids,
        "document_node_ids": document_node_ids,
        "cap_node_ids": cap_node_ids,
        "cap_version_ids": cap_version_ids,
        "message_ids": [row["id"] for row in message_rows],
        "artifact_paths": artifact_paths,
        "counts": {
            "files": len(file_rows),
            "structuredResults": structured_result_count if scope_type == "folder" else count_rows(conn, "structured_results", case_id),
            "captableVersions": len(cap_version_ids),
            "messages": len(message_rows),
        },
    }


def perform_case_deletion(case_id: str, scope_type: str, scope_ref: str) -> dict[str, Any]:
    init_store()
    requested_at = utc_now()

    with connect() as conn:
        scope = collect_deletion_scope(conn, case_id, scope_type, scope_ref)
        deletion_event_id = unique_id("deletion")
        create_deletion_event(conn, deletion_event_id, case_id, scope_type, scope_ref, scope["counts"], requested_at)

        if scope_type == "case":
            delete_case_records(conn, case_id)
        else:
            delete_folder_records(conn, case_id, scope_ref, scope, requested_at)

    file_errors = remove_document_artifacts(scope["artifact_paths"])
    if file_errors:
        error_message = "; ".join(file_errors)
        mark_deletion_event_failed(deletion_event_id, error_message)
        raise RuntimeError(f"Failed to complete physical deletion. deletion_event_id={deletion_event_id}. {error_message}")

    mark_deletion_event_completed(deletion_event_id)
    return {
        "scopeType": scope_type,
        "scopeRef": scope_ref,
        "removedCounts": scope["counts"],
        "deletionEventId": deletion_event_id,
        "workbench": build_workbench_snapshot(case_id) if scope_type == "folder" else None,
    }


def create_deletion_event(
    conn: sqlite3.Connection,
    deletion_event_id: str,
    case_id: str,
    scope_type: str,
    scope_ref: str,
    counts: dict[str, int],
    requested_at: str,
) -> None:
    conn.execute(
        """
        INSERT INTO deletion_events
        (id, scope_type, case_id, scope_ref, removed_file_count, removed_structured_result_count,
         removed_captable_version_count, removed_message_count, status, requested_at, completed_at, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
        """,
        (
            deletion_event_id,
            scope_type,
            case_id,
            scope_ref,
            counts["files"],
            counts["structuredResults"],
            counts["captableVersions"],
            counts["messages"],
            DELETION_STATUS_PENDING,
            requested_at,
        ),
    )


def mark_deletion_event_completed(deletion_event_id: str) -> None:
    with connect() as conn:
        conn.execute(
            "UPDATE deletion_events SET status = ?, completed_at = ?, error_message = NULL WHERE id = ?",
            (DELETION_STATUS_COMPLETED, utc_now(), deletion_event_id),
        )


def mark_deletion_event_failed(deletion_event_id: str, error_message: str) -> None:
    with connect() as conn:
        conn.execute(
            "UPDATE deletion_events SET status = ?, completed_at = ?, error_message = ? WHERE id = ?",
            (DELETION_STATUS_FAILED, utc_now(), error_message, deletion_event_id),
        )


def delete_folder_records(
    conn: sqlite3.Connection,
    case_id: str,
    folder_path: str,
    scope: dict[str, Any],
    now: str,
) -> None:
    document_ids = scope["document_ids"]
    document_node_ids = scope["document_node_ids"]
    cap_node_ids = scope["cap_node_ids"]
    cap_version_ids = scope["cap_version_ids"]

    if cap_version_ids:
        delete_operation_logs_for_nodes(conn, case_id, cap_node_ids)
        delete_refs_for_nodes(conn, case_id, cap_node_ids)
        delete_ids(conn, "captable_versions", "id", case_id, cap_version_ids)
        delete_ids(conn, "topology_nodes", "id", case_id, cap_node_ids)

    if document_node_ids:
        delete_operation_logs_for_nodes(conn, case_id, document_node_ids)
        delete_refs_for_nodes(conn, case_id, document_node_ids)
        delete_ids(conn, "topology_nodes", "id", case_id, document_node_ids)

    delete_ids(conn, "structured_results", "document_id", case_id, document_ids)
    delete_ids(conn, "files", "id", case_id, document_ids)
    conn.execute("DELETE FROM case_messages WHERE case_id = ?", (case_id,))
    conn.execute(
        """
        INSERT INTO operation_logs (id, case_id, action, node_id, description, created_at)
        VALUES (?, ?, 'archive', ?, ?, ?)
        """,
        (
            unique_id("log-folder-remove"),
            case_id,
            folder_path,
            f"Permanently deleted folder {folder_path} and its workspace-derived data.",
            now,
        ),
    )
    reset_case_head_pointers(conn, case_id, now)
    rebuild_case_captable_versions(conn, case_id)


def delete_case_records(conn: sqlite3.Connection, case_id: str) -> None:
    conn.execute("DELETE FROM case_messages WHERE case_id = ?", (case_id,))
    conn.execute("DELETE FROM operation_logs WHERE case_id = ?", (case_id,))
    conn.execute("DELETE FROM topology_refs WHERE case_id = ?", (case_id,))
    conn.execute("DELETE FROM captable_versions WHERE case_id = ?", (case_id,))
    conn.execute("DELETE FROM topology_nodes WHERE case_id = ?", (case_id,))
    conn.execute("DELETE FROM structured_results WHERE case_id = ?", (case_id,))
    conn.execute("DELETE FROM files WHERE case_id = ?", (case_id,))
    conn.execute("DELETE FROM cases WHERE id = ?", (case_id,))


def delete_ids(
    conn: sqlite3.Connection,
    table: str,
    field: str,
    case_id: str,
    values: list[str],
) -> None:
    if not values:
        return
    placeholders = ",".join("?" for _ in values)
    conn.execute(f"DELETE FROM {table} WHERE case_id = ? AND {field} IN ({placeholders})", (case_id, *values))


def delete_operation_logs_for_nodes(conn: sqlite3.Connection, case_id: str, node_ids: list[str]) -> None:
    if not node_ids:
        return
    placeholders = ",".join("?" for _ in node_ids)
    conn.execute(f"DELETE FROM operation_logs WHERE case_id = ? AND node_id IN ({placeholders})", (case_id, *node_ids))


def delete_refs_for_nodes(conn: sqlite3.Connection, case_id: str, node_ids: list[str]) -> None:
    if not node_ids:
        return
    placeholders = ",".join("?" for _ in node_ids)
    conn.execute(
        f"DELETE FROM topology_refs WHERE case_id = ? AND (from_node_id IN ({placeholders}) OR to_node_id IN ({placeholders}))",
        (case_id, *node_ids, *node_ids),
    )


def count_rows(conn: sqlite3.Connection, table: str, case_id: str) -> int:
    row = conn.execute(f"SELECT COUNT(*) AS count FROM {table} WHERE case_id = ?", (case_id,)).fetchone()
    return int(row["count"])


def count_ids(conn: sqlite3.Connection, table: str, field: str, case_id: str, values: list[str]) -> int:
    if not values:
        return 0
    placeholders = ",".join("?" for _ in values)
    row = conn.execute(
        f"SELECT COUNT(*) AS count FROM {table} WHERE case_id = ? AND {field} IN ({placeholders})",
        (case_id, *values),
    ).fetchone()
    return int(row["count"])


def remove_folder(case_id: str, folder_path: str) -> dict[str, Any]:
    normalized_folder = normalize_folder_path(folder_path)
    if not normalized_folder:
        raise ValueError("Folder path is required")
    return perform_case_deletion(case_id, "folder", normalized_folder)


def delete_case(case_id: str) -> dict[str, Any]:
    return perform_case_deletion(case_id, "case", case_id)


def list_case_messages(case_id: str = DEFAULT_CASE_ID) -> list[dict[str, Any]]:
    create_case(case_id, "Default financing audit")
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM case_messages WHERE case_id = ? ORDER BY created_at, rowid",
            (case_id,),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "role": row["role"],
            "content": row["content"],
            "createdAt": row["created_at"],
        }
        for row in rows
    ]


def append_case_message(case_id: str, role: str, content: str) -> dict[str, Any]:
    create_case(case_id, "Default financing audit")
    message = {
        "id": unique_id("msg"),
        "role": role,
        "content": content,
        "createdAt": utc_now(),
    }
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO case_messages (id, case_id, role, content, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (message["id"], case_id, message["role"], message["content"], message["createdAt"]),
        )
    return message


def get_node_detail(node_id: str) -> dict[str, Any]:
    snapshot = build_workbench_snapshot(DEFAULT_CASE_ID)
    node = next((item for item in snapshot["topology"]["nodes"] if item["id"] == node_id), None)
    if not node:
        raise KeyError(node_id)
    related_ids = {
        value
        for ref in snapshot["topology"]["refs"]
        if node_id in {ref["fromNodeId"], ref["toNodeId"]}
        for value in (ref["fromNodeId"], ref["toNodeId"])
        if value != node_id
    }
    return {
        "node": node,
        "document": next((item for item in snapshot["documents"] if item["id"] == node["entityId"]), None),
        "structuredResult": next(
            (
                item
                for item in snapshot["structuredResults"]
                if item["documentId"] == node["entityId"] or item["id"] == node["entityId"]
            ),
            None,
        ),
        "captableVersion": next((item for item in snapshot["captableVersions"] if item["id"] == node["entityId"]), None),
        "relatedNodes": [item for item in snapshot["topology"]["nodes"] if item["id"] in related_ids],
        "availableActions": ["merge", "reject", "archive", "view"]
        if node["status"] == "draft"
        else ["archive", "view"]
        if node["status"] == "rejected"
        else ["view"],
    }


def set_viewing_version(case_id: str, node_id: str) -> dict[str, Any]:
    with connect() as conn:
        if not get_node(conn, node_id):
            raise KeyError(node_id)
        now = utc_now()
        conn.execute(
            "UPDATE cases SET current_viewing_node_id = ?, updated_at = ? WHERE id = ?",
            (node_id, now, case_id),
        )
        conn.execute(
            "INSERT INTO operation_logs (id, case_id, action, node_id, description, created_at) VALUES (?, ?, 'view', ?, ?, ?)",
            (unique_id("log-view"), case_id, node_id, f"Switched viewing version to {node_id}.", now),
        )
    return build_workbench_snapshot(case_id)


def update_node_status(node_id: str, status: str, action: str) -> dict[str, Any]:
    with connect() as conn:
        node = get_node(conn, node_id)
        if not node:
            raise KeyError(node_id)
        now = utc_now()
        conn.execute("UPDATE topology_nodes SET status = ?, updated_at = ? WHERE id = ?", (status, now, node_id))
        conn.execute(
            "INSERT INTO operation_logs (id, case_id, action, node_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (unique_id(f"log-{action}"), node["case_id"], action, node_id, f"Marked {node['label']} as {status}.", now),
        )
    return build_workbench_snapshot(node["case_id"])


def merge_node(node_id: str) -> dict[str, Any]:
    with connect() as conn:
        node = get_node(conn, node_id)
        if not node:
            raise KeyError(node_id)
        now = utc_now()
        conn.execute("UPDATE topology_nodes SET status = 'merged', updated_at = ? WHERE id = ?", (now, node_id))
        cap_node_id, _ = create_captable_version(conn, node["case_id"], node_id, f"{node['label']} merged", node["entity_id"])
        conn.execute(
            "UPDATE cases SET current_trunk_node_id = ?, current_viewing_node_id = ?, updated_at = ? WHERE id = ?",
            (cap_node_id, cap_node_id, now, node["case_id"]),
        )
        conn.execute(
            "INSERT INTO operation_logs (id, case_id, action, node_id, description, created_at) VALUES (?, ?, 'merge', ?, ?, ?)",
            (unique_id("log-merge"), node["case_id"], node_id, f"Merged draft branch {node['label']} into trunk.", now),
        )
    return build_workbench_snapshot(node["case_id"])


def classify_file(file_name: str, title: str) -> str:
    text = f"{file_name} {title}".lower()
    if ("draft" in text or "amendment" in text) and "final" not in text:
        return "draft_transaction"
    if "side letter" in text:
        return "side_letter"
    if any(value in text for value in ["consent", "board", "resolution"]):
        return "board_resolution"
    if any(value in text for value in ["voting", "investors rights", "right of first refusal", "stock purchase", "safe"]):
        return "finalized_transaction"
    return "other"


def infer_security_type(title: str) -> str:
    text = title.lower()
    if "safe" in text:
        return "SAFE Conversion"
    if "preferred" in text or "series" in text or "stock purchase" in text:
        return "Preferred"
    if "founder" in text or "common" in text:
        return "Common"
    return "Unknown Security"


def write_captable_rows(conn: sqlite3.Connection, case_id: str, version_id: str, document_ids: list[str]) -> None:
    rows: list[dict[str, Any]] = []
    seen_keys: set[tuple[str, str, str, float]] = set()
    for document_id in document_ids:
        file_row = conn.execute("SELECT * FROM files WHERE id = ?", (document_id,)).fetchone()
        result_row = conn.execute("SELECT raw_json FROM structured_results WHERE document_id = ?", (document_id,)).fetchone()
        raw = json.loads(result_row["raw_json"]) if result_row else {}
        title = file_row["file_name"] if file_row else document_id
        for row in extract_captable_rows(raw, title, document_id):
            key = (row["holder"], row["security"], row["location"], row["shares"])
            if key in seen_keys:
                continue
            seen_keys.add(key)
            rows.append(row)

    total = sum(row["shares"] for row in rows)
    for row in rows:
        ownership = round((row["shares"] / total) * 100, 2) if total else 0
        conn.execute(
            """
            INSERT INTO captable_rows
            (id, version_id, holder_name, security_type, shares, ownership_percentage,
             source_document_id, source_location)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                unique_id("row"),
                version_id,
                row["holder"],
                row["security"],
                row["shares"],
                ownership,
                row["document_id"],
                row["location"],
            ),
        )


def rebuild_generated_captables() -> None:
    """Recompute cached cap table rows after extractor improvements.

    Cap table rows are derived from stored structured results, not user-authored
    records. Rebuilding keeps older local demo databases from showing stale
    regex false positives such as "1 Preferred Stock".
    """

    with connect() as conn:
        versions = list(conn.execute("SELECT * FROM captable_versions ORDER BY created_at"))
        for version in versions:
            document_ids = json.loads(version["generated_from_document_ids_json"])
            conn.execute("DELETE FROM captable_rows WHERE version_id = ?", (version["id"],))
            write_captable_rows(conn, version["case_id"], version["id"], document_ids)
            row_count = conn.execute(
                "SELECT COUNT(*) AS count FROM captable_rows WHERE version_id = ?",
                (version["id"],),
            ).fetchone()["count"]
            conn.execute(
                "UPDATE captable_versions SET summary = ? WHERE id = ?",
                (
                    f"Generated from {len(document_ids)} document(s). "
                    f"{row_count} material cap table row(s) were reconstructed from evidence.",
                    version["id"],
                ),
            )


def extract_captable_rows(raw: dict[str, Any], title: str, document_id: str) -> list[dict[str, Any]]:
    candidates = raw.get("raw_candidates", {}) if isinstance(raw.get("raw_candidates"), dict) else {}
    share_candidates = candidates.get("share_counts", []) if isinstance(candidates.get("share_counts"), list) else []
    rows: list[dict[str, Any]] = []

    for candidate in share_candidates:
        if not isinstance(candidate, dict):
            continue
        source_text = str(candidate.get("source_text") or "")
        paragraph_id = candidate.get("paragraph_id", "unknown")
        location = f"paragraph {paragraph_id}"
        text = clean_capitalization_text(source_text)

        rows.extend(extract_common_outstanding_rows(text, document_id, location))
        rows.extend(extract_preferred_outstanding_rows(text, document_id, location))
        rows.extend(extract_stock_plan_rows(text, document_id, location))
        rows.extend(extract_minimum_closing_rows(text, document_id, location))

    if rows:
        return dedupe_captable_rows(rows)

    return extract_llm_share_rows(raw, title, document_id)


def extract_common_outstanding_rows(text: str, document_id: str, location: str) -> list[dict[str, Any]]:
    rows = []
    match = re.search(
        r"(?P<authorized>\d[\d,]*)\s+shares\s+of\s+common\s+stock.*?"
        r"(?P<outstanding>\d[\d,]*)\s+shares\s+of\s+which\s+are\s+issued\s+and\s+outstanding",
        text,
        flags=re.IGNORECASE,
    )
    if match:
        rows.append(
            captable_row(
                "Existing common stockholders",
                "Common Stock",
                match.group("outstanding"),
                document_id,
                location,
            )
        )
    return rows


def extract_preferred_outstanding_rows(text: str, document_id: str, location: str) -> list[dict[str, Any]]:
    rows = []
    pattern = re.compile(
        r"(?P<shares>\d[\d,]*)\s+shares\s+have\s+been\s+designated\s+"
        r"(?P<series>Series\s+[A-Za-z0-9-]+\s+Preferred\s+Stock),\s+"
        r"(?P<status>all|none)\s+of\s+which\s+are\s+issued\s+and\s+outstanding",
        flags=re.IGNORECASE,
    )
    for match in pattern.finditer(text):
        if match.group("status").lower() != "all":
            continue
        series = normalize_security_name(match.group("series"))
        rows.append(captable_row(f"Existing {series} holders", series, match.group("shares"), document_id, location))
    return rows


def extract_stock_plan_rows(text: str, document_id: str, location: str) -> list[dict[str, Any]]:
    if "stock plan" not in text.lower():
        return []

    rows = []
    options_match = re.search(
        r"options\s+to\s+purchase\s+(?P<shares>\d[\d,]*)\s+shares\s+have\s+been\s+granted\s+and\s+are\s+currently\s+outstanding",
        text,
        flags=re.IGNORECASE,
    )
    if options_match:
        rows.append(captable_row("Optionholders", "Common Stock Options", options_match.group("shares"), document_id, location))

    available_match = re.search(
        r"(?P<shares>\d[\d,]*)\s+shares\s+of\s+Common\s+Stock\s+remain\s+available\s+for\s+issuance",
        text,
        flags=re.IGNORECASE,
    )
    if available_match:
        rows.append(
            captable_row("Unallocated option pool", "Common Stock Reserved", available_match.group("shares"), document_id, location)
        )

    return rows


def extract_minimum_closing_rows(text: str, document_id: str, location: str) -> list[dict[str, Any]]:
    match = re.search(
        r"minimum\s+of\s+(?P<shares>\d[\d,]*)\s+Shares\s+must\s+be\s+sold\s+at\s+the\s+Initial\s+Closing",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        return []
    return [
        captable_row(
            "Series A purchasers (minimum closing)",
            "Series A Preferred Stock",
            match.group("shares"),
            document_id,
            location,
        )
    ]


def extract_llm_share_rows(raw: dict[str, Any], title: str, document_id: str) -> list[dict[str, Any]]:
    financing_terms = raw.get("financing_terms", {}) if isinstance(raw.get("financing_terms"), dict) else {}
    share_amounts = financing_terms.get("share_amounts", [])
    if not isinstance(share_amounts, list):
        return []

    rows = []
    for index, value in enumerate(share_amounts[:10], start=1):
        shares = parse_number(json.dumps(value, ensure_ascii=False) if isinstance(value, dict) else str(value))
        if shares < MIN_CAPTABLE_SHARE_COUNT:
            continue
        holder = extract_named_value(value, ["holder", "purchaser", "stockholder", "party"]) or f"Extracted holder {index}"
        security = extract_named_value(value, ["security", "security_class", "class", "series"]) or infer_security_type(title)
        source = extract_named_value(value, ["source", "sourceLocation", "source_location"]) or "LLM financing terms"
        rows.append(captable_row(holder, security, shares, document_id, source))
    return dedupe_captable_rows(rows)


def captable_row(holder: str, security: str, shares: str | float, document_id: str, location: str) -> dict[str, Any]:
    parsed_shares = parse_number(str(shares))
    if parsed_shares < MIN_CAPTABLE_SHARE_COUNT:
        parsed_shares = 0
    return {
        "holder": holder,
        "security": security,
        "shares": parsed_shares,
        "document_id": document_id,
        "location": location,
    }


def dedupe_captable_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped = []
    seen: set[tuple[str, str, float]] = set()
    for row in rows:
        if row["shares"] <= 0:
            continue
        key = (row["holder"].lower(), row["security"].lower(), row["shares"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped


def clean_capitalization_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()


def normalize_security_name(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().replace("seed", "Seed")


def extract_named_value(value: Any, keys: list[str]) -> str | None:
    if not isinstance(value, dict):
        return None
    for key in keys:
        item = value.get(key)
        if item:
            return str(item)
    evidence = value.get("evidence")
    if isinstance(evidence, list) and evidence:
        first = evidence[0]
        if isinstance(first, dict) and first.get("paragraph_id") is not None:
            return f"paragraph {first['paragraph_id']}"
    return None


def build_index_from_db(case_id: str = DEFAULT_CASE_ID) -> dict[str, Any]:
    snapshot = build_workbench_snapshot(case_id)
    return {
        "generated_at": utc_now(),
        "document_count": len(snapshot["documents"]),
        "documents": [
            {
                "source_file": item["fileName"],
                "document_title": item["summary"],
                "document_type": item["fileType"],
                "key_dates": [{"date_iso": item["transactionDate"]}] if item.get("transactionDate") else [],
                "main_parties": [],
                "confidence": 0.0,
                "status": item["processingStatus"],
                "output_file": f"{safe_stem(Path(item['fileName']))}.json",
            }
            for item in snapshot["documents"]
        ],
    }


def generated_document_ids(conn: sqlite3.Connection, case_id: str, include_document_id: str | None = None) -> list[str]:
    ids = [
        row["id"]
        for row in conn.execute(
            """
            SELECT id FROM files
            WHERE case_id = ? AND file_type IN ('finalized_transaction', 'board_resolution')
            ORDER BY uploaded_at
            """,
            (case_id,),
        )
    ]
    if include_document_id and include_document_id not in ids:
        ids.append(include_document_id)
    return ids


def current_version(conn: sqlite3.Connection, case_id: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM captable_versions WHERE case_id = ? AND status = 'current' ORDER BY created_at DESC LIMIT 1",
        (case_id,),
    ).fetchone()


def get_case_field(conn: sqlite3.Connection, case_id: str, field: str) -> str | None:
    row = conn.execute(f"SELECT {field} FROM cases WHERE id = ?", (case_id,)).fetchone()
    return row[field] if row else None


def get_node(conn: sqlite3.Connection, node_id: str | None) -> sqlite3.Row | None:
    if not node_id:
        return None
    return conn.execute("SELECT * FROM topology_nodes WHERE id = ?", (node_id,)).fetchone()


def next_index(conn: sqlite3.Connection, case_id: str, depth: int) -> int:
    row = conn.execute(
        "SELECT COUNT(*) AS count FROM topology_nodes WHERE case_id = ? AND depth = ?",
        (case_id, depth),
    ).fetchone()
    return int(row["count"])


def unique_id(prefix: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9_-]+", "-", prefix).strip("-").lower()
    return f"{clean}-{uuid4().hex[:8]}"


def ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def normalize_relative_path(relative_path: str | None) -> str | None:
    if not relative_path:
        return None
    normalized = relative_path.replace("\\", "/").strip().strip("/")
    return normalized or None


def normalize_folder_path(folder_path: str | None) -> str:
    if not folder_path:
        return ""
    normalized = folder_path.replace("\\", "/").strip().strip("/")
    return ROOT_FOLDER_NAME if normalized == ROOT_FOLDER_NAME else normalized


def folder_path_from_relative_path(relative_path: str | None) -> str | None:
    normalized = normalize_relative_path(relative_path)
    if not normalized or "/" not in normalized:
        return None
    return normalized.rsplit("/", 1)[0] or None


def reset_case_head_pointers(conn: sqlite3.Connection, case_id: str, now: str | None = None) -> None:
    cap_node = conn.execute(
        """
        SELECT id FROM topology_nodes
        WHERE case_id = ? AND node_type = 'captable_version'
        ORDER BY created_at DESC, rowid DESC
        LIMIT 1
        """,
        (case_id,),
    ).fetchone()
    document_node = conn.execute(
        """
        SELECT id FROM topology_nodes
        WHERE case_id = ? AND entity_type = 'file'
        ORDER BY created_at DESC, rowid DESC
        LIMIT 1
        """,
        (case_id,),
    ).fetchone()
    fallback_id = (cap_node["id"] if cap_node else None) or (document_node["id"] if document_node else None)
    conn.execute(
        "UPDATE cases SET current_trunk_node_id = ?, current_viewing_node_id = ?, updated_at = ? WHERE id = ?",
        (fallback_id, fallback_id, now or utc_now(), case_id),
    )


def rebuild_case_captable_versions(conn: sqlite3.Connection, case_id: str) -> None:
    cap_rows = conn.execute(
        """
        SELECT id, topology_node_id FROM captable_versions
        WHERE case_id = ?
        ORDER BY created_at
        """,
        (case_id,),
    ).fetchall()
    if not cap_rows:
        return

    current_cap_version_id = cap_rows[-1]["id"]
    for index, row in enumerate(cap_rows):
        status = "current" if row["id"] == current_cap_version_id else "historical"
        document_node = conn.execute(
            "SELECT parent_id FROM topology_nodes WHERE id = ?",
            (row["topology_node_id"],),
        ).fetchone()
        include_document_id = None
        if document_node and document_node["parent_id"]:
            parent = conn.execute(
                "SELECT entity_id FROM topology_nodes WHERE id = ?",
                (document_node["parent_id"],),
            ).fetchone()
            if parent:
                include_document_id = parent["entity_id"]

        document_ids = generated_document_ids(conn, case_id, include_document_id)
        summary = (
            f"Generated from {len(document_ids)} document(s). Rows are evidence-backed demo calculations."
            if document_ids
            else "Generated from 0 document(s). Rows are evidence-backed demo calculations."
        )
        conn.execute(
            """
            UPDATE captable_versions
            SET parent_version_id = ?, generated_from_document_ids_json = ?, status = ?, summary = ?
            WHERE id = ?
            """,
            (
                cap_rows[index - 1]["id"] if index > 0 else None,
                json.dumps(document_ids, ensure_ascii=False),
                status,
                summary,
                row["id"],
            ),
        )
        conn.execute("DELETE FROM captable_rows WHERE version_id = ?", (row["id"],))
        write_captable_rows(conn, case_id, row["id"], document_ids)


def artifact_stem_for_source_path(source_path: str) -> str:
    stem = Path(source_path).stem.strip().lower()
    stem = re.sub(r"[^a-z0-9]+", "_", stem)
    return stem.strip("_") or "document"


def document_artifact_paths(source_path: str) -> list[Path]:
    source = Path(source_path)
    artifact_stem = artifact_stem_for_source_path(source_path)
    return [
        source,
        DEFAULT_OUTPUT_DIR / "candidates" / f"{artifact_stem}.candidates.json",
        DEFAULT_OUTPUT_DIR / "parsed" / f"{artifact_stem}.parsed.json",
        DEFAULT_OUTPUT_DIR / f"{artifact_stem}.json",
    ]


def document_artifact_paths_from_rows(file_rows: list[sqlite3.Row]) -> set[Path]:
    paths: set[Path] = set()
    for row in file_rows:
        raw_artifacts = row["artifact_paths_json"] if "artifact_paths_json" in row.keys() else None
        if raw_artifacts:
            try:
                for item in json.loads(raw_artifacts):
                    if item:
                        paths.add(Path(str(item)))
                continue
            except json.JSONDecodeError:
                pass
        for path in document_artifact_paths(row["source_path"]):
            paths.add(path)
    return paths


def remove_document_artifacts(paths: set[Path]) -> list[str]:
    errors: list[str] = []
    for path in sorted(paths):
        try:
            if path.exists():
                path.unlink()
        except OSError as exc:
            errors.append(f"{path}: {exc}")
    return errors


def parse_number(value: str) -> float:
    match = re.search(r"\d[\d,]*(?:\.\d+)?", value)
    return float(match.group(0).replace(",", "")) if match else 0.0


def infer_holder(source_text: str, index: int) -> str:
    quoted = re.findall(r"[A-Z][A-Za-z0-9&.,' -]{2,60}", source_text)
    for item in quoted:
        if any(skip in item.lower() for skip in ["shares", "preferred", "common", "stock", "agreement"]):
            continue
        return item.strip()
    return f"Unassigned holder {index}"


def infer_transaction_date(result: dict[str, Any]) -> str | None:
    dates = result.get("dates") if isinstance(result.get("dates"), list) else []
    for item in dates:
        if isinstance(item, dict) and item.get("date_iso"):
            return str(item["date_iso"])
    candidates = result.get("raw_candidates", {}).get("dates", [])
    for item in candidates:
        if isinstance(item, dict) and item.get("date_iso"):
            return str(item["date_iso"])
    return None


def map_processing_status(result: dict[str, Any]) -> str:
    status = result.get("processing_metadata", {}).get("status", "processed")
    if status == "failed":
        return "error"
    if status == "candidates_ready":
        return "needs_review"
    return "processed"


def infer_evidence_status(result: dict[str, Any], file_type: str) -> str:
    if file_type == "draft_transaction":
        return "unverified"
    if result.get("risks_or_review_items"):
        return "conflict"
    if map_processing_status(result) == "needs_review":
        return "unverified"
    return "verified"


def normalize_parties(result: dict[str, Any]) -> list[str]:
    parties = result.get("parties") if isinstance(result.get("parties"), list) else []
    values: list[str] = []
    for item in parties:
        if isinstance(item, dict) and item.get("name"):
            values.append(str(item["name"]))
        elif isinstance(item, str):
            values.append(item)
    return values[:10]


def build_document_summary(result: dict[str, Any], title: str, file_type: str) -> str:
    status = result.get("processing_metadata", {}).get("status", "processed")
    return f"{title or 'Untitled document'} classified as {file_type}; processing status {status}."


def infer_transaction_type(result: dict[str, Any], file_type: str) -> str:
    return str(result.get("document_type") or file_type.replace("_", " ").title())


def build_impact_summary(result: dict[str, Any], file_type: str) -> str:
    counts = result.get("candidate_group_counts", {})
    share_count = len(result.get("raw_candidates", {}).get("share_counts", []))
    return f"{file_type.replace('_', ' ')} produced {share_count} share candidate(s) and {sum(counts.values()) if isinstance(counts, dict) else 0} review paragraph(s)."


def build_extracted_terms(result: dict[str, Any]) -> list[dict[str, str]]:
    terms: list[dict[str, str]] = []
    raw = result.get("raw_candidates", {})
    for name, values in [("Share candidate", raw.get("share_counts", [])), ("Money candidate", raw.get("money", [])), ("Date candidate", raw.get("dates", []))]:
        for item in values[:5] if isinstance(values, list) else []:
            terms.append(
                {
                    "name": name,
                    "value": str(item.get("value", "")),
                    "sourceLocation": f"paragraph {item.get('paragraph_id', 'unknown')}",
                }
            )
    return terms[:12]


def build_evidence_findings(result: dict[str, Any]) -> list[dict[str, Any]]:
    findings = []
    for term in build_extracted_terms(result):
        findings.append(
            {
                "field": term["name"].lower().replace(" ", "_"),
                "value": term["value"],
                "source": term["sourceLocation"],
                "confidence": 0.72,
                "issue": "Needs human review before legal reliance.",
            }
        )
    return findings[:8]


def build_ai_explanation(result: dict[str, Any], file_type: str) -> str:
    title = result.get("document_title") or result.get("source_file") or "This document"
    return f"{title} was parsed locally and linked into the {file_type.replace('_', ' ')} workflow with evidence candidates preserved."


def document_payload(row: sqlite3.Row) -> dict[str, Any]:
    relative_path = normalize_relative_path(row["relative_path"]) if "relative_path" in row.keys() else None
    return {
        "id": row["id"],
        "fileName": row["file_name"],
        "fileType": row["file_type"],
        "transactionDate": row["transaction_date"],
        "uploadedAt": row["uploaded_at"],
        "sourcePath": row["source_path"],
        "relativePath": relative_path,
        "folderPath": folder_path_from_relative_path(relative_path),
        "storageProvider": row["storage_provider"],
        "processingStatus": row["processing_status"],
        "evidenceStatus": row["evidence_status"],
        "summary": row["summary"],
    }


def get_document_record(case_id: str, document_id: str) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM files WHERE id = ? AND case_id = ?",
            (document_id, case_id),
        ).fetchone()

    if not row:
        raise KeyError(document_id)

    return document_payload(row)


def structured_payload(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "documentId": row["document_id"],
        "transactionType": row["transaction_type"],
        "parties": json.loads(row["parties_json"]),
        "effectiveDate": row["effective_date"],
        "captableImpactSummary": row["captable_impact_summary"],
        "extractedTerms": json.loads(row["extracted_terms_json"]),
        "evidenceFindings": json.loads(row["evidence_findings_json"]),
        "aiExplanation": row["ai_explanation"],
        "createdAt": row["created_at"],
    }


def node_payload(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "parentId": row["parent_id"],
        "children": [],
        "refs": json.loads(row["refs_json"]),
        "depth": row["depth"],
        "index": row["node_index"],
        "label": row["label"],
        "status": row["status"],
        "nodeType": row["node_type"],
        "entityId": row["entity_id"],
        "entityType": row["entity_type"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def captable_payload(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    rows = [
        {
            "holderName": item["holder_name"],
            "securityType": item["security_type"],
            "shares": int(item["shares"]) if float(item["shares"]).is_integer() else item["shares"],
            "ownershipPercentage": item["ownership_percentage"],
            "sourceDocumentId": item["source_document_id"],
            "sourceLocation": item["source_location"],
        }
        for item in conn.execute("SELECT * FROM captable_rows WHERE version_id = ? ORDER BY rowid", (row["id"],))
    ]
    return {
        "id": row["id"],
        "topologyNodeId": row["topology_node_id"],
        "parentVersionId": row["parent_version_id"],
        "versionName": row["version_name"],
        "generatedFromDocumentIds": json.loads(row["generated_from_document_ids_json"]),
        "status": row["status"],
        "summary": row["summary"],
        "rows": rows,
        "createdAt": row["created_at"],
    }


def attach_children(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id = {node["id"]: node for node in nodes}
    for node in nodes:
        parent_id = node.get("parentId")
        if parent_id in by_id:
            by_id[parent_id]["children"].append(node["id"])
    return nodes


def build_document_previews(structured: list[dict[str, Any]]) -> list[dict[str, Any]]:
    previews = []
    for result in structured:
        first = result["extractedTerms"][0] if result["extractedTerms"] else None
        text = first["value"] if first else result["captableImpactSummary"]
        previews.append(
            {
                "documentId": result["documentId"],
                "title": result["transactionType"],
                "excerpt": result["aiExplanation"],
                "highlightedPhrases": [
                    {
                        "text": text,
                        "sourceLabel": first["sourceLocation"] if first else "Processed candidates",
                        "tone": "neutral",
                    }
                ],
            }
        )
    return previews
