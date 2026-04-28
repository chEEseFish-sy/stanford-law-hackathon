import json
import tempfile
import unittest
from pathlib import Path

from backend import workbench_store as store


def build_result(source_name: str, title: str) -> dict:
    return {
        "source_file": source_name,
        "document_title": title,
        "processing_metadata": {"status": "processed"},
        "raw_candidates": {"share_counts": []},
        "candidate_group_counts": {},
    }


class DeletionFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)
        self.original_output_dir = store.DEFAULT_OUTPUT_DIR
        self.original_db_path = store.DB_PATH
        self.original_root_dir = store.ROOT_DIR
        self.original_input_dir = store.DEFAULT_INPUT_DIR

        store.ROOT_DIR = self.root
        store.DEFAULT_INPUT_DIR = self.root / "data"
        store.DEFAULT_OUTPUT_DIR = self.root / "storage"
        store.DB_PATH = store.DEFAULT_OUTPUT_DIR / "vericap.sqlite3"

        (store.DEFAULT_OUTPUT_DIR / "uploads").mkdir(parents=True, exist_ok=True)
        (store.DEFAULT_OUTPUT_DIR / "parsed").mkdir(parents=True, exist_ok=True)
        (store.DEFAULT_OUTPUT_DIR / "candidates").mkdir(parents=True, exist_ok=True)
        store.init_store()

    def tearDown(self) -> None:
        store.DEFAULT_OUTPUT_DIR = self.original_output_dir
        store.DB_PATH = self.original_db_path
        store.ROOT_DIR = self.original_root_dir
        store.DEFAULT_INPUT_DIR = self.original_input_dir
        self.tmpdir.cleanup()

    def seed_document(self, case_id: str, file_name: str, relative_path: str | None, title: str) -> None:
        source_path = store.DEFAULT_OUTPUT_DIR / "uploads" / file_name
        source_path.write_text("fixture", encoding="utf-8")
        for artifact_path in store.document_artifact_paths(str(source_path))[1:]:
            artifact_path.parent.mkdir(parents=True, exist_ok=True)
            artifact_path.write_text(json.dumps({"source_file": file_name}), encoding="utf-8")
        store.ingest_processed_result(
            case_id=case_id,
            result=build_result(file_name, title),
            source_path=str(source_path),
            relative_path=relative_path,
        )

    def test_remove_folder_deletes_records_files_and_writes_audit(self) -> None:
        case_id = "case-default"
        self.seed_document(case_id, "Series A Stock Purchase Agreement.docx", "alpha/Series A Stock Purchase Agreement.docx", "Series A Stock Purchase Agreement")
        self.seed_document(case_id, "Written Consent Board.docx", "alpha/Written Consent Board.docx", "Written Consent Board")
        store.append_case_message(case_id, "user", "What changed?")

        result = store.remove_folder(case_id, "alpha")

        self.assertEqual(result["scopeType"], "folder")
        self.assertEqual(result["removedCounts"]["files"], 2)
        self.assertEqual(result["removedCounts"]["messages"], 0)
        self.assertIsNotNone(result["workbench"])
        self.assertEqual(result["workbench"]["documents"], [])

        with store.connect() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) AS count FROM files WHERE case_id = ?", (case_id,)).fetchone()["count"], 0)
            self.assertEqual(conn.execute("SELECT COUNT(*) AS count FROM structured_results WHERE case_id = ?", (case_id,)).fetchone()["count"], 0)
            self.assertEqual(conn.execute("SELECT COUNT(*) AS count FROM case_messages WHERE case_id = ?", (case_id,)).fetchone()["count"], 1)
            event = conn.execute("SELECT * FROM deletion_events WHERE id = ?", (result["deletionEventId"],)).fetchone()

        self.assertEqual(event["status"], store.DELETION_STATUS_COMPLETED)
        self.assertEqual(event["scope_type"], "folder")
        self.assertEqual(event["removed_file_count"], 2)
        self.assertFalse(any(store.DEFAULT_OUTPUT_DIR.glob("uploads/*.docx")))
        self.assertFalse(any(store.DEFAULT_OUTPUT_DIR.glob("*.json")))
        self.assertFalse(any((store.DEFAULT_OUTPUT_DIR / "parsed").glob("*.json")))
        self.assertFalse(any((store.DEFAULT_OUTPUT_DIR / "candidates").glob("*.json")))

    def test_remove_missing_folder_raises_key_error(self) -> None:
        with self.assertRaises(KeyError):
            store.remove_folder("case-default", "missing-folder")

    def test_delete_case_deletes_case_and_audits(self) -> None:
        case_id = "case-delete-me"
        store.create_case(case_id, "Delete Me")
        self.seed_document(case_id, "Series B Closing Checklist.docx", "beta/Series B Closing Checklist.docx", "Series B Closing Checklist")
        store.append_case_message(case_id, "assistant", "Cleanup this case")

        result = store.delete_case(case_id)

        self.assertEqual(result["scopeType"], "case")
        self.assertEqual(result["scopeRef"], case_id)
        self.assertIsNone(result["workbench"])

        with store.connect() as conn:
            self.assertIsNone(conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone())
            self.assertEqual(conn.execute("SELECT COUNT(*) AS count FROM files WHERE case_id = ?", (case_id,)).fetchone()["count"], 0)
            self.assertEqual(conn.execute("SELECT COUNT(*) AS count FROM structured_results WHERE case_id = ?", (case_id,)).fetchone()["count"], 0)
            self.assertEqual(conn.execute("SELECT COUNT(*) AS count FROM topology_nodes WHERE case_id = ?", (case_id,)).fetchone()["count"], 0)
            self.assertEqual(conn.execute("SELECT COUNT(*) AS count FROM case_messages WHERE case_id = ?", (case_id,)).fetchone()["count"], 0)
            event = conn.execute("SELECT * FROM deletion_events WHERE id = ?", (result["deletionEventId"],)).fetchone()

        self.assertEqual(event["status"], store.DELETION_STATUS_COMPLETED)
        self.assertEqual(event["scope_type"], "case")
        self.assertFalse(any(store.DEFAULT_OUTPUT_DIR.glob("uploads/*.docx")))

    def test_get_node_detail_uses_document_case_instead_of_default_case(self) -> None:
        case_id = "case-isolated"
        store.create_case(case_id, "Isolated")
        self.seed_document(case_id, "Isolated SPA.docx", "isolated/Isolated SPA.docx", "Isolated SPA")

        snapshot = store.build_workbench_snapshot(case_id)
        node_id = snapshot["topology"]["nodes"][0]["id"]
        detail = store.get_node_detail(node_id)

        self.assertEqual(detail["node"]["id"], node_id)
        self.assertEqual(detail["document"]["fileName"], "Isolated SPA.docx")

    def test_set_viewing_version_rejects_node_from_another_case(self) -> None:
        first_case_id = "case-first"
        second_case_id = "case-second"
        store.create_case(first_case_id, "First")
        store.create_case(second_case_id, "Second")
        self.seed_document(first_case_id, "First SPA.docx", "first/First SPA.docx", "First SPA")
        self.seed_document(second_case_id, "Second SPA.docx", "second/Second SPA.docx", "Second SPA")

        second_snapshot = store.build_workbench_snapshot(second_case_id)
        foreign_node_id = second_snapshot["topology"]["nodes"][0]["id"]

        with self.assertRaises(KeyError):
            store.set_viewing_version(first_case_id, foreign_node_id)

    def test_document_artifact_paths_are_unique_for_distinct_physical_uploads(self) -> None:
        first_source = store.DEFAULT_OUTPUT_DIR / "uploads" / "case_alpha__series_a__a1.docx"
        second_source = store.DEFAULT_OUTPUT_DIR / "uploads" / "case_beta__series_a__b2.docx"

        first_paths = store.document_artifact_paths(str(first_source))
        second_paths = store.document_artifact_paths(str(second_source))

        self.assertEqual(first_paths[0], first_source)
        self.assertEqual(second_paths[0], second_source)
        self.assertNotEqual({path.name for path in first_paths}, {path.name for path in second_paths})


if __name__ == "__main__":
    unittest.main()
