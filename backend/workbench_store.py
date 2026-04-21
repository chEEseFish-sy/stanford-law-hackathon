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
DEFAULT_CASE_NAME = "Private financing audit"
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


def captable_summary(document_count: int, row_count: int, projection_count: int) -> str:
    return (
        f"Generated from {document_count} document(s). "
        f"{row_count} cap table row(s) across {projection_count} projection(s), all traceable to extracted events."
    )


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

            CREATE TABLE IF NOT EXISTS document_facts (
              id TEXT PRIMARY KEY,
              case_id TEXT NOT NULL REFERENCES cases(id),
              document_id TEXT NOT NULL REFERENCES files(id),
              fact_type TEXT NOT NULL,
              label TEXT NOT NULL,
              value_json TEXT NOT NULL,
              source_location TEXT NOT NULL,
              source_text TEXT NOT NULL,
              confidence REAL NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS equity_events (
              id TEXT PRIMARY KEY,
              case_id TEXT NOT NULL REFERENCES cases(id),
              document_id TEXT NOT NULL REFERENCES files(id),
              event_type TEXT NOT NULL,
              effective_date TEXT,
              holder_name TEXT NOT NULL,
              counterparty_name TEXT,
              security_type TEXT NOT NULL,
              share_class TEXT,
              series TEXT,
              quantity REAL NOT NULL,
              unit_price REAL,
              amount REAL,
              status TEXT NOT NULL,
              source_evidence_ids_json TEXT NOT NULL,
              confidence REAL NOT NULL,
              review_status TEXT NOT NULL,
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
        ensure_column(conn, "captable_rows", "event_ids_json", "TEXT")
        ensure_column(conn, "captable_rows", "evidence_ids_json", "TEXT")
        ensure_column(conn, "captable_rows", "confidence", "REAL")
        ensure_column(conn, "captable_rows", "review_status", "TEXT")
        ensure_column(conn, "captable_rows", "view_type", "TEXT")
        ensure_column(conn, "captable_rows", "event_status", "TEXT")
        ensure_column(conn, "captable_rows", "share_class", "TEXT")
        ensure_column(conn, "captable_rows", "series", "TEXT")

    seed_if_empty()
    rebuild_generated_captables()


def seed_if_empty() -> None:
    with connect() as conn:
        count = conn.execute("SELECT COUNT(*) AS count FROM cases").fetchone()["count"]
    if count:
        return

    create_case(DEFAULT_CASE_ID, DEFAULT_CASE_NAME)


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
    create_case(case_id, DEFAULT_CASE_NAME)
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
        fact_ids = insert_document_facts(conn, case_id, document_id, result, file_type, now)
        insert_equity_events(conn, case_id, document_id, result, file_type, fact_ids, now)

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
            captable_summary(len(document_ids), 0, 0),
            now,
        ),
    )
    write_captable_rows(conn, case_id, cap_version_id, document_ids)
    row_count = conn.execute(
        "SELECT COUNT(*) AS count FROM captable_rows WHERE version_id = ?",
        (cap_version_id,),
    ).fetchone()["count"]
    projection_count = conn.execute(
        "SELECT COUNT(DISTINCT view_type) AS count FROM captable_rows WHERE version_id = ?",
        (cap_version_id,),
    ).fetchone()["count"]
    conn.execute(
        "UPDATE captable_versions SET summary = ? WHERE id = ?",
        (captable_summary(len(document_ids), row_count, projection_count), cap_version_id),
    )
    return cap_node_id, cap_version_id


def insert_document_facts(
    conn: sqlite3.Connection,
    case_id: str,
    document_id: str,
    result: dict[str, Any],
    file_type: str,
    now: str,
) -> list[str]:
    facts = build_document_facts(result, file_type)
    fact_ids: list[str] = []
    for fact in facts:
        fact_id = unique_id("fact")
        fact_ids.append(fact_id)
        conn.execute(
            """
            INSERT INTO document_facts
            (id, case_id, document_id, fact_type, label, value_json, source_location, source_text, confidence, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                fact_id,
                case_id,
                document_id,
                fact["fact_type"],
                fact["label"],
                json.dumps(fact["value"], ensure_ascii=False),
                fact["source_location"],
                fact["source_text"],
                fact["confidence"],
                now,
            ),
        )
    return fact_ids


def insert_equity_events(
    conn: sqlite3.Connection,
    case_id: str,
    document_id: str,
    result: dict[str, Any],
    file_type: str,
    fact_ids: list[str],
    now: str,
) -> list[str]:
    events = build_equity_events(result, file_type, fact_ids)
    event_ids: list[str] = []
    for event in events:
        event_id = unique_id("event")
        event_ids.append(event_id)
        conn.execute(
            """
            INSERT INTO equity_events
            (id, case_id, document_id, event_type, effective_date, holder_name, counterparty_name, security_type,
             share_class, series, quantity, unit_price, amount, status, source_evidence_ids_json, confidence,
             review_status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                case_id,
                document_id,
                event["event_type"],
                event["effective_date"],
                event["holder_name"],
                event["counterparty_name"],
                event["security_type"],
                event["share_class"],
                event["series"],
                event["quantity"],
                event["unit_price"],
                event["amount"],
                event["status"],
                json.dumps(event["source_evidence_ids"], ensure_ascii=False),
                event["confidence"],
                event["review_status"],
                now,
            ),
        )
    return event_ids


def build_document_facts(result: dict[str, Any], file_type: str) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    facts.extend(build_party_facts(result))
    facts.extend(build_date_facts(result))
    facts.extend(build_security_facts(result))
    facts.extend(build_holder_facts(result))
    facts.extend(build_transaction_facts(result))
    facts.extend(build_raw_candidate_facts(result))
    facts.extend(build_table_facts(result))

    if not facts:
        facts.append(
            {
                "fact_type": "document_summary",
                "label": file_type,
                "value": {"document_type": infer_transaction_type(result, file_type)},
                "source_location": "document",
                "source_text": build_document_summary(result, result.get("document_title") or "Untitled document", file_type),
                "confidence": 0.4,
            }
        )
    return facts


def build_party_facts(result: dict[str, Any]) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    parties = result.get("parties") if isinstance(result.get("parties"), list) else []
    for item in parties:
        if isinstance(item, dict):
            evidence = item.get("evidence") if isinstance(item.get("evidence"), list) else []
            source_location, source_text = evidence_to_source(evidence)
            facts.append(
                {
                    "fact_type": "party",
                    "label": str(item.get("name") or item.get("role") or "party"),
                    "value": item,
                    "source_location": source_location,
                    "source_text": source_text,
                    "confidence": 0.78,
                }
            )
    return facts


def build_date_facts(result: dict[str, Any]) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    dates = result.get("dates") if isinstance(result.get("dates"), list) else []
    for item in dates:
        if isinstance(item, dict):
            evidence = item.get("evidence") if isinstance(item.get("evidence"), list) else []
            source_location, source_text = evidence_to_source(evidence)
            facts.append(
                {
                    "fact_type": "date",
                    "label": str(item.get("meaning") or item.get("date_original") or "date"),
                    "value": item,
                    "source_location": source_location,
                    "source_text": source_text,
                    "confidence": 0.74,
                }
            )
    return facts


def build_security_facts(result: dict[str, Any]) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    security_facts = result.get("security_facts") if isinstance(result.get("security_facts"), list) else []
    for item in security_facts:
        if isinstance(item, dict):
            evidence = item.get("evidence") if isinstance(item.get("evidence"), list) else []
            source_location, source_text = evidence_to_source(evidence)
            label = " ".join(
                value
                for value in [str(item.get("series") or "").strip(), str(item.get("security_type") or "").strip()]
                if value
            ) or "security fact"
            facts.append(
                {
                    "fact_type": "security",
                    "label": label,
                    "value": item,
                    "source_location": source_location,
                    "source_text": source_text,
                    "confidence": 0.76,
                }
            )
    return facts


def build_holder_facts(result: dict[str, Any]) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    holder_facts = result.get("holder_facts") if isinstance(result.get("holder_facts"), list) else []
    for item in holder_facts:
        if isinstance(item, dict):
            evidence = item.get("evidence") if isinstance(item.get("evidence"), list) else []
            source_location, source_text = evidence_to_source(evidence)
            facts.append(
                {
                    "fact_type": "holder",
                    "label": str(item.get("holder_name") or "holder fact"),
                    "value": item,
                    "source_location": source_location,
                    "source_text": source_text,
                    "confidence": 0.76,
                }
            )
    return facts


def build_transaction_facts(result: dict[str, Any]) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    transaction_facts = result.get("transaction_facts") if isinstance(result.get("transaction_facts"), list) else []
    for item in transaction_facts:
        if isinstance(item, dict):
            evidence = item.get("evidence") if isinstance(item.get("evidence"), list) else []
            source_location, source_text = evidence_to_source(evidence)
            facts.append(
                {
                    "fact_type": "transaction",
                    "label": str(item.get("event_type") or "transaction fact"),
                    "value": item,
                    "source_location": source_location,
                    "source_text": source_text,
                    "confidence": 0.8,
                }
            )
    return facts


def build_raw_candidate_facts(result: dict[str, Any]) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    raw = result.get("raw_candidates", {}) if isinstance(result.get("raw_candidates"), dict) else {}
    for fact_type, key in [("share_candidate", "share_counts"), ("money_candidate", "money"), ("date_candidate", "dates")]:
        values = raw.get(key) if isinstance(raw.get(key), list) else []
        for item in values[:24]:
            if not isinstance(item, dict):
                continue
            facts.append(
                {
                    "fact_type": fact_type,
                    "label": str(item.get("value") or fact_type),
                    "value": item,
                    "source_location": f"paragraph {item.get('paragraph_id', 'unknown')}",
                    "source_text": str(item.get("source_text") or ""),
                    "confidence": 0.62,
                }
            )
    return facts


def build_table_facts(result: dict[str, Any]) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    table_facts = result.get("table_facts") if isinstance(result.get("table_facts"), list) else []
    for item in table_facts[:20]:
        if not isinstance(item, dict):
            continue
        facts.append(
            {
                "fact_type": "table",
                "label": "table rows",
                "value": item,
                "source_location": f"paragraph {item.get('paragraph_id', 'unknown')}",
                "source_text": str(item.get("source_text") or ""),
                "confidence": 0.68,
            }
        )
    return facts


def build_equity_events(result: dict[str, Any], file_type: str, fact_ids: list[str]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    events.extend(build_explicit_transaction_events(result, file_type, fact_ids))
    events.extend(build_holder_events(result, file_type, fact_ids))
    events.extend(build_regex_candidate_events(result, file_type, fact_ids))
    events.extend(build_llm_share_amount_events(result, file_type, fact_ids))
    return dedupe_equity_events(events)


def build_explicit_transaction_events(result: dict[str, Any], file_type: str, fact_ids: list[str]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    transaction_facts = result.get("transaction_facts") if isinstance(result.get("transaction_facts"), list) else []
    for item in transaction_facts:
        if not isinstance(item, dict):
            continue
        event_type = str(item.get("event_type") or infer_event_type(file_type))
        share_class = str(item.get("share_class") or "")
        status_hint = str(item.get("status") or "").strip() or None
        source_text = extract_evidence_text(item.get("evidence"))
        quantity = parse_number(str(item.get("quantity") or item.get("share_count") or "0"))
        if quantity <= 0:
            continue
        events.append(
            equity_event(
                event_type=event_type,
                effective_date=str(item.get("date_iso") or "") or infer_transaction_date(result),
                holder_name=str(item.get("holder_name") or "Unknown holder"),
                security_type=str(item.get("security_type") or infer_security_type(result.get("document_title") or "")),
                share_class=share_class,
                series=str(item.get("series") or ""),
                quantity=quantity,
                unit_price=parse_optional_number(item.get("unit_price")),
                amount=parse_optional_number(item.get("amount")),
                status=normalize_event_status(
                    file_type=file_type,
                    event_type=event_type,
                    share_class=share_class,
                    context="transaction_fact",
                    source_text=source_text,
                    status_hint=status_hint,
                ),
                source_evidence_ids=fact_ids,
                confidence=0.84,
                review_status="needs_review",
            )
        )
    return events


def build_holder_events(result: dict[str, Any], file_type: str, fact_ids: list[str]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    holder_facts = result.get("holder_facts") if isinstance(result.get("holder_facts"), list) else []
    for item in holder_facts:
        if not isinstance(item, dict):
            continue
        event_type = normalize_holder_event_type(str(item.get("security_type") or ""), str(item.get("share_class") or ""))
        share_class = str(item.get("share_class") or "")
        source_text = extract_evidence_text(item.get("evidence"))
        quantity = parse_number(str(item.get("share_count") or "0"))
        if quantity <= 0:
            continue
        events.append(
            equity_event(
                event_type=event_type,
                effective_date=infer_transaction_date(result),
                holder_name=str(item.get("holder_name") or "Unknown holder"),
                security_type=str(item.get("security_type") or infer_security_type(result.get("document_title") or "")),
                share_class=share_class,
                series=str(item.get("series") or ""),
                quantity=quantity,
                unit_price=parse_optional_number(item.get("unit_price") or item.get("price_per_share")),
                amount=parse_optional_number(item.get("cash_paid")),
                status=normalize_event_status(
                    file_type=file_type,
                    event_type=event_type,
                    share_class=share_class,
                    context="holder_fact",
                    source_text=source_text,
                ),
                source_evidence_ids=fact_ids,
                confidence=0.78,
                review_status="needs_review",
            )
        )
    return events


def build_regex_candidate_events(result: dict[str, Any], file_type: str, fact_ids: list[str]) -> list[dict[str, Any]]:
    raw = result.get("raw_candidates", {}) if isinstance(result.get("raw_candidates"), dict) else {}
    share_candidates = raw.get("share_counts") if isinstance(raw.get("share_counts"), list) else []
    events: list[dict[str, Any]] = []
    for candidate in share_candidates:
        if not isinstance(candidate, dict):
            continue
        source_text = str(candidate.get("source_text") or "")
        location = f"paragraph {candidate.get('paragraph_id', 'unknown')}"
        text = clean_capitalization_text(source_text)
        events.extend(extract_common_outstanding_events(text, file_type, location, fact_ids, result))
        events.extend(extract_preferred_outstanding_events(text, file_type, location, fact_ids, result))
        events.extend(extract_stock_plan_events(text, file_type, location, fact_ids, result))
        events.extend(extract_minimum_closing_events(text, file_type, location, fact_ids, result))
    return events


def build_llm_share_amount_events(result: dict[str, Any], file_type: str, fact_ids: list[str]) -> list[dict[str, Any]]:
    financing_terms = result.get("financing_terms", {}) if isinstance(result.get("financing_terms"), dict) else {}
    share_amounts = financing_terms.get("share_amounts")
    if not isinstance(share_amounts, list):
        return []
    events: list[dict[str, Any]] = []
    for index, value in enumerate(share_amounts[:12], start=1):
        shares = parse_number(json.dumps(value, ensure_ascii=False) if isinstance(value, dict) else str(value))
        if shares < MIN_CAPTABLE_SHARE_COUNT:
            continue
        holder = extract_named_value(value, ["holder", "holder_name", "purchaser", "stockholder", "party"]) or f"Extracted holder {index}"
        security = extract_named_value(value, ["security", "security_type", "security_class", "class", "series"]) or infer_security_type(result.get("document_title") or "")
        share_class = extract_named_value(value, ["share_class", "security_class", "class"]) or ""
        event_type = normalize_holder_event_type(security, share_class)
        events.append(
            equity_event(
                event_type=event_type,
                effective_date=infer_transaction_date(result),
                holder_name=holder,
                security_type=security,
                share_class=share_class,
                series=infer_series(security),
                quantity=shares,
                unit_price=None,
                amount=None,
                status=normalize_event_status(
                    file_type=file_type,
                    event_type=event_type,
                    share_class=share_class,
                    context="llm_share_amount",
                    source_text=json.dumps(value, ensure_ascii=False) if isinstance(value, dict) else str(value),
                ),
                source_evidence_ids=fact_ids,
                confidence=0.66,
                review_status="needs_review",
            )
        )
    return events


def equity_event(
    *,
    event_type: str,
    effective_date: str | None,
    holder_name: str,
    security_type: str,
    share_class: str,
    series: str,
    quantity: float,
    unit_price: float | None,
    amount: float | None,
    status: str,
    source_evidence_ids: list[str],
    confidence: float,
    review_status: str,
    counterparty_name: str | None = None,
) -> dict[str, Any]:
    return {
        "event_type": event_type,
        "effective_date": effective_date,
        "holder_name": holder_name,
        "counterparty_name": counterparty_name,
        "security_type": security_type,
        "share_class": share_class,
        "series": series,
        "quantity": quantity,
        "unit_price": unit_price,
        "amount": amount,
        "status": status,
        "source_evidence_ids": source_evidence_ids[:12],
        "confidence": confidence,
        "review_status": review_status,
    }


def build_workbench_snapshot(case_id: str = DEFAULT_CASE_ID) -> dict[str, Any]:
    init_store()
    with connect() as conn:
        case = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
        if not case:
            create_case(case_id, DEFAULT_CASE_NAME)
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
    delete_ids(conn, "equity_events", "document_id", case_id, document_ids)
    delete_ids(conn, "document_facts", "document_id", case_id, document_ids)
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
    conn.execute("DELETE FROM equity_events WHERE case_id = ?", (case_id,))
    conn.execute("DELETE FROM document_facts WHERE case_id = ?", (case_id,))
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
    create_case(case_id, DEFAULT_CASE_NAME)
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
    create_case(case_id, DEFAULT_CASE_NAME)
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
    with connect() as conn:
        node_row = get_node(conn, node_id)
    if not node_row:
        raise KeyError(node_id)
    snapshot = build_workbench_snapshot(node_row["case_id"])
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
    rows = build_captable_rows_from_events(conn, case_id, document_ids)
    view_totals = {
        view_type: sum(item["shares"] for item in rows if item["view_type"] == view_type)
        for view_type in {item["view_type"] for item in rows}
    }
    for row in rows:
        denominator = view_totals.get(row["view_type"], 0)
        ownership = round((row["shares"] / denominator) * 100, 2) if denominator else 0
        conn.execute(
            """
            INSERT INTO captable_rows
            (id, version_id, holder_name, security_type, shares, ownership_percentage,
             source_document_id, source_location, event_ids_json, evidence_ids_json, confidence, review_status,
             view_type, event_status, share_class, series)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                json.dumps(row["event_ids"], ensure_ascii=False),
                json.dumps(row["evidence_ids"], ensure_ascii=False),
                row["confidence"],
                row["review_status"],
                row["view_type"],
                row["status"],
                row["share_class"],
                row["series"],
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
            projection_count = conn.execute(
                "SELECT COUNT(DISTINCT view_type) AS count FROM captable_rows WHERE version_id = ?",
                (version["id"],),
            ).fetchone()["count"]
            conn.execute(
                "UPDATE captable_versions SET summary = ? WHERE id = ?",
                (captable_summary(len(document_ids), row_count, projection_count), version["id"]),
            )


def build_captable_rows_from_events(
    conn: sqlite3.Connection,
    case_id: str,
    document_ids: list[str],
) -> list[dict[str, Any]]:
    if not document_ids:
        return []
    placeholders = ",".join("?" for _ in document_ids)
    event_rows = list(
        conn.execute(
            f"""
            SELECT * FROM equity_events
            WHERE case_id = ?
              AND document_id IN ({placeholders})
              AND quantity > 0
            ORDER BY effective_date, created_at, rowid
            """,
            (case_id, *document_ids),
        )
    )
    aggregated: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    for row in event_rows:
        for view_type in projection_types_for_event(row):
            status = row["status"] or "issued"
            security = format_projection_security(row, view_type)
            holder = str(row["holder_name"] or "Unknown holder")
            key = (view_type, holder, security, status)
            bucket = aggregated.get(key)
            evidence_ids = json.loads(row["source_evidence_ids_json"]) if row["source_evidence_ids_json"] else []
            if bucket is None:
                aggregated[key] = {
                    "holder": holder,
                    "security": security,
                    "shares": float(row["quantity"]),
                    "document_id": row["document_id"],
                    "location": build_event_location(row),
                    "event_ids": [row["id"]],
                    "evidence_ids": evidence_ids,
                    "confidence": float(row["confidence"] or 0.0),
                    "review_status": row["review_status"] or "needs_review",
                    "status": status,
                    "view_type": view_type,
                    "share_class": str(row["share_class"] or ""),
                    "series": str(row["series"] or ""),
                }
            else:
                bucket["shares"] += float(row["quantity"])
                bucket["event_ids"].append(row["id"])
                bucket["evidence_ids"] = dedupe_str_list([*bucket["evidence_ids"], *evidence_ids])
                bucket["confidence"] = round((bucket["confidence"] + float(row["confidence"] or 0.0)) / 2, 2)
                if bucket["review_status"] != row["review_status"]:
                    bucket["review_status"] = "needs_review"
    return [row for row in aggregated.values() if row["shares"] > 0]


def projection_types_for_event(row: sqlite3.Row) -> list[str]:
    status = str(row["status"] or "issued")
    if status == "reserved":
        return ["reserved_pool", "fully_diluted"]
    if status in {"issued", "outstanding"}:
        return ["issued_outstanding", "fully_diluted"]
    if status == "approved":
        return ["fully_diluted"]
    return ["fully_diluted"]


def format_projection_security(row: sqlite3.Row, view_type: str) -> str:
    security = str(row["security_type"] or "Unknown Security")
    if view_type == "reserved_pool":
        if str(row["share_class"] or "") == "Options":
            return f"{security} Reserved"
        return f"{security} Pool"
    return security


def extract_common_outstanding_events(
    text: str,
    file_type: str,
    location: str,
    fact_ids: list[str],
    result: dict[str, Any],
) -> list[dict[str, Any]]:
    events = []
    match = re.search(
        r"(?P<authorized>\d[\d,]*)\s+shares\s+of\s+common\s+stock.*?"
        r"(?P<outstanding>\d[\d,]*)\s+shares\s+of\s+which\s+are\s+issued\s+and\s+outstanding",
        text,
        flags=re.IGNORECASE,
    )
    if match:
        events.append(
            equity_event(
                event_type=infer_event_type(file_type),
                effective_date=infer_transaction_date(result),
                holder_name="Existing common stockholders",
                security_type="Common Stock",
                share_class="Common Stock",
                series="",
                quantity=parse_number(match.group("outstanding")),
                unit_price=None,
                amount=None,
                status="outstanding",
                source_evidence_ids=fact_ids,
                confidence=0.82,
                review_status="needs_review",
            )
        )
    return events


def extract_preferred_outstanding_events(
    text: str,
    file_type: str,
    location: str,
    fact_ids: list[str],
    result: dict[str, Any],
) -> list[dict[str, Any]]:
    events = []
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
        events.append(
            equity_event(
                event_type=infer_event_type(file_type),
                effective_date=infer_transaction_date(result),
                holder_name=f"Existing {series} holders",
                security_type=series,
                share_class="Preferred Stock",
                series=series,
                quantity=parse_number(match.group("shares")),
                unit_price=None,
                amount=None,
                status="outstanding",
                source_evidence_ids=fact_ids,
                confidence=0.84,
                review_status="needs_review",
            )
        )
    return events


def extract_stock_plan_events(
    text: str,
    file_type: str,
    location: str,
    fact_ids: list[str],
    result: dict[str, Any],
) -> list[dict[str, Any]]:
    if "stock plan" not in text.lower():
        return []

    events = []
    options_match = re.search(
        r"options\s+to\s+purchase\s+(?P<shares>\d[\d,]*)\s+shares\s+have\s+been\s+granted\s+and\s+are\s+currently\s+outstanding",
        text,
        flags=re.IGNORECASE,
    )
    if options_match:
        events.append(
            equity_event(
                event_type="option_grant",
                effective_date=infer_transaction_date(result),
                holder_name="Optionholders",
                security_type="Common Stock Options",
                share_class="Options",
                series="",
                quantity=parse_number(options_match.group("shares")),
                unit_price=None,
                amount=None,
                status=normalize_event_status(
                    file_type=file_type,
                    event_type="option_grant",
                    share_class="Options",
                    context="options_outstanding_clause",
                    source_text=text,
                ),
                source_evidence_ids=fact_ids,
                confidence=0.8,
                review_status="needs_review",
            )
        )

    available_match = re.search(
        r"(?P<shares>\d[\d,]*)\s+shares\s+of\s+Common\s+Stock\s+remain\s+available\s+for\s+issuance",
        text,
        flags=re.IGNORECASE,
    )
    if available_match:
        events.append(
            equity_event(
                event_type="option_pool_increase",
                effective_date=infer_transaction_date(result),
                holder_name="Unallocated option pool",
                security_type="Common Stock",
                share_class="Common Stock",
                series="",
                quantity=parse_number(available_match.group("shares")),
                unit_price=None,
                amount=None,
                status=normalize_event_status(
                    file_type=file_type,
                    event_type="option_pool_increase",
                    share_class="Options",
                    context="available_for_issuance_clause",
                    source_text=text,
                ),
                source_evidence_ids=fact_ids,
                confidence=0.8,
                review_status="needs_review",
            )
        )

    return events


def extract_minimum_closing_events(
    text: str,
    file_type: str,
    location: str,
    fact_ids: list[str],
    result: dict[str, Any],
) -> list[dict[str, Any]]:
    match = re.search(
        r"minimum\s+of\s+(?P<shares>\d[\d,]*)\s+Shares\s+must\s+be\s+sold\s+at\s+the\s+Initial\s+Closing",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        return []
    return [
        equity_event(
            event_type="preferred_financing",
            effective_date=infer_transaction_date(result),
            holder_name="Series A purchasers (minimum closing)",
            security_type="Series A Preferred Stock",
            share_class="Preferred Stock",
            series="Series A",
            quantity=parse_number(match.group("shares")),
            unit_price=None,
            amount=None,
            status=normalize_event_status(
                file_type=file_type,
                event_type="preferred_financing",
                share_class="Preferred Stock",
                context="minimum_closing",
                source_text=text,
            ),
            source_evidence_ids=fact_ids,
            confidence=0.76,
            review_status="needs_review",
        )
    ]


def dedupe_equity_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped = []
    seen: set[tuple[str, str, str, float, str]] = set()
    for event in events:
        if event["quantity"] <= 0:
            continue
        key = (
            event["holder_name"].lower(),
            event["security_type"].lower(),
            event["event_type"].lower(),
            event["quantity"],
            event["status"].lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(event)
    return deduped


def clean_capitalization_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()


def normalize_security_name(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().replace("seed", "Seed")


def infer_event_type(file_type: str) -> str:
    if file_type == "board_resolution":
        return "board_approval"
    if file_type == "draft_transaction":
        return "proposed_financing"
    if file_type == "side_letter":
        return "side_letter_adjustment"
    return "stock_issuance"


def infer_event_status(file_type: str, context: Any = None) -> str:
    if file_type == "draft_transaction":
        return "proposed"
    if context == "minimum_closing":
        return "approved"
    return "issued"


def normalize_holder_event_type(security_type: str, share_class: str) -> str:
    normalized = f"{security_type} {share_class}".lower()
    if "option" in normalized:
        return "option_grant"
    if "preferred" in normalized or "series" in normalized:
        return "preferred_financing"
    return "stock_issuance"


def normalize_event_status(
    *,
    file_type: str,
    event_type: str,
    share_class: str,
    context: str | None,
    source_text: str | None,
    status_hint: str | None = None,
) -> str:
    normalized_hint = (status_hint or "").strip().lower()
    if normalized_hint in {"issued", "outstanding", "reserved", "proposed", "approved"}:
        return normalized_hint

    text = (source_text or "").lower()
    share_class_text = (share_class or "").lower()

    if file_type == "draft_transaction":
        if event_type == "option_pool_increase":
            return "proposed"
        return "proposed"

    if context in {"available_for_issuance_clause", "option_pool_increase"}:
        return "reserved"

    if event_type == "option_pool_increase":
        if "remain available" in text or "reserved" in text or "available for issuance" in text:
            return "reserved"
        if file_type == "board_resolution":
            return "approved"
        return "reserved"

    if "issued and outstanding" in text or "currently outstanding" in text:
        return "outstanding"

    if context == "minimum_closing":
        return "approved"

    if event_type == "preferred_financing":
        if "must be sold" in text or "minimum closing" in text:
            return "approved"
        if file_type == "board_resolution":
            return "approved"
        return "issued"

    if event_type == "option_grant":
        if "granted and are currently outstanding" in text or "outstanding option" in text:
            return "outstanding"
        if file_type == "board_resolution":
            return "approved"
        return "issued"

    if file_type == "board_resolution":
        if "authorized" in text or "approved" in text:
            return "approved"
        if "reserved" in text and "option" in share_class_text:
            return "reserved"
        return "approved"

    return infer_event_status(file_type, context)


def describe_event_status(status: str) -> str:
    meanings = {
        "issued": "Issued based on extracted transaction or holder evidence, but not explicitly stated as currently outstanding.",
        "outstanding": "Explicitly described as currently issued and outstanding in the source evidence.",
        "reserved": "Reserved for future issuance and excluded from issued/outstanding counts.",
        "proposed": "Appears in draft or preliminary transaction language and should not be treated as executed issuance.",
        "approved": "Authorized or approved in source documents, but not yet confirmed as issued and outstanding.",
    }
    return meanings.get(status, "Derived from extracted event evidence and still requires legal review.")


def extract_evidence_text(value: Any) -> str:
    evidence = value if isinstance(value, list) else []
    if evidence and isinstance(evidence[0], dict):
        return str(evidence[0].get("source_text") or "")
    return ""


def parse_optional_number(value: Any) -> float | None:
    if value in (None, "", [], {}):
        return None
    parsed = parse_number(json.dumps(value, ensure_ascii=False) if isinstance(value, dict) else str(value))
    return parsed if parsed > 0 else None


def infer_series(security: str) -> str:
    match = re.search(r"(Series\s+[A-Za-z0-9-]+)", security, flags=re.IGNORECASE)
    return normalize_security_name(match.group(1)) if match else ""


def evidence_to_source(evidence: list[dict[str, Any]]) -> tuple[str, str]:
    if evidence:
        first = evidence[0]
        return (
            f"paragraph {first.get('paragraph_id', 'unknown')}",
            str(first.get("source_text") or ""),
        )
    return ("document", "")


def dedupe_str_list(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        deduped.append(value)
    return deduped


def build_event_location(row: sqlite3.Row) -> str:
    if row["effective_date"]:
        return f"{row['status']} @ {row['effective_date']}"
    return row["status"]


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
                captable_summary(len(document_ids), 0, 0),
                row["id"],
            ),
        )
        conn.execute("DELETE FROM captable_rows WHERE version_id = ?", (row["id"],))
        write_captable_rows(conn, case_id, row["id"], document_ids)
        row_count = conn.execute(
            "SELECT COUNT(*) AS count FROM captable_rows WHERE version_id = ?",
            (row["id"],),
        ).fetchone()["count"]
        projection_count = conn.execute(
            "SELECT COUNT(DISTINCT view_type) AS count FROM captable_rows WHERE version_id = ?",
            (row["id"],),
        ).fetchone()["count"]
        conn.execute(
            "UPDATE captable_versions SET summary = ? WHERE id = ?",
            (captable_summary(len(document_ids), row_count, projection_count), row["id"]),
        )


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
    event_count = len(result.get("transaction_facts", [])) if isinstance(result.get("transaction_facts"), list) else 0
    holder_count = len(result.get("holder_facts", [])) if isinstance(result.get("holder_facts"), list) else 0
    return (
        f"{file_type.replace('_', ' ')} produced {share_count} share candidate(s), "
        f"{event_count} transaction fact(s), and {holder_count} holder fact(s) "
        f"from {sum(counts.values()) if isinstance(counts, dict) else 0} review paragraph(s)."
    )


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
    for fact in result.get("holder_facts", [])[:5] if isinstance(result.get("holder_facts"), list) else []:
        if not isinstance(fact, dict):
            continue
        terms.append(
            {
                "name": "Holder fact",
                "value": str(fact.get("holder_name") or fact.get("share_count") or ""),
                "sourceLocation": evidence_to_source(fact.get("evidence") if isinstance(fact.get("evidence"), list) else [])[0],
            }
        )
    for fact in result.get("transaction_facts", [])[:5] if isinstance(result.get("transaction_facts"), list) else []:
        if not isinstance(fact, dict):
            continue
        terms.append(
            {
                "name": "Transaction fact",
                "value": str(fact.get("event_type") or fact.get("quantity") or ""),
                "sourceLocation": evidence_to_source(fact.get("evidence") if isinstance(fact.get("evidence"), list) else [])[0],
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
            "eventIds": json.loads(item["event_ids_json"]) if item["event_ids_json"] else [],
            "evidenceIds": json.loads(item["evidence_ids_json"]) if item["evidence_ids_json"] else [],
            "confidence": item["confidence"] if item["confidence"] is not None else 0.0,
            "reviewStatus": item["review_status"] or "needs_review",
            "viewType": item["view_type"] or "issued_outstanding",
            "eventStatus": item["event_status"] or "issued",
            "statusMeaning": describe_event_status(item["event_status"] or "issued"),
            "shareClass": item["share_class"] or "",
            "series": item["series"] or "",
        }
        for item in conn.execute("SELECT * FROM captable_rows WHERE version_id = ? ORDER BY rowid", (row["id"],))
    ]
    projections = sorted({item["viewType"] for item in rows})
    return {
        "id": row["id"],
        "topologyNodeId": row["topology_node_id"],
        "parentVersionId": row["parent_version_id"],
        "versionName": row["version_name"],
        "generatedFromDocumentIds": json.loads(row["generated_from_document_ids_json"]),
        "status": row["status"],
        "summary": row["summary"],
        "rows": rows,
        "projections": projections,
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
