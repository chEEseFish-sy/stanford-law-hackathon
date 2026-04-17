# Folder-Based DOCX Upload and Folder-Level Removal Design

## Summary

This design adds folder-based DOCX upload to the workbench frontend and replaces file-level deletion with folder-level removal in the `Files` module. The feature preserves folder structure across refreshes by storing each file's relative path in the backend and rebuilding grouped folder views from server data.

The user-facing chat language remains Chinese, but all product UI copy introduced by this feature must be English.

## Problem

The current workbench supports multi-file upload, but it treats uploaded files as a flat list. That creates three gaps:

1. Users cannot upload an entire folder of source documents in one action.
2. The `Files` module cannot show directory structure, which makes large uploads harder to scan.
3. The current file-level delete affordance does not match the desired workflow, where folder uploads should be managed as a single unit.

## Goals

- Support selecting and uploading an entire folder from the frontend.
- Accept only `.docx` files for folder uploads.
- Preserve relative folder structure after upload and page refresh.
- Display uploaded files grouped by folder in the `Files` module with collapsible sections.
- Remove file-level deletion from the UI.
- Allow only folder-level removal, guarded by a custom confirmation modal that matches the existing web style.
- Keep all new UI copy in English.

## Non-Goals

- Redesigning the upload entry button layout or overall dashboard styling in this pass.
- Supporting non-DOCX uploads for folder-based upload.
- Adding nested multi-level folder tree rendering beyond a single grouped folder list.
- Allowing file-level delete or recovery actions.

## Current State

The current frontend upload flow lives in `Dashboard.tsx` and sends an array of `File` objects through `WorkbenchContext` to `topologyApi.uploadFiles()`. The backend upload route already validates `.docx` and rejects other extensions, but it only persists flat file metadata. The `Files` panel renders a flat list of documents and local uploads, and each file currently exposes a delete button.

The backend data model already stores `source_path`, which is a good foundation for preserving relative path metadata, but the current upload protocol does not send browser folder-relative paths.

## Recommended Approach

Use a full-stack approach:

1. Read `webkitRelativePath` from browser-selected files when a folder is uploaded.
2. Filter to `.docx` files on the frontend and provide English feedback for ignored files or empty folders.
3. Send ordered relative path metadata alongside uploaded files.
4. Persist relative path information in backend file records.
5. Return `relativePath` and `folderPath` in workbench document payloads.
6. Render the `Files` panel as collapsible folder groups.
7. Replace file-level delete with folder-level removal backed by a persistent backend endpoint.

This approach is preferred over a frontend-only grouping solution because the folder structure must survive refreshes and support durable removal behavior.

## Architecture

### Frontend

The frontend keeps the current upload flow but extends it with folder metadata handling.

- Folder-selected files are collected from a file input configured for directory selection.
- Each local upload preview stores:
  - `relativePath`
  - `folderPath`
  - existing preview fields such as `fileName`, `kind`, `content`, and `uploadedAt`
- The `Files` panel no longer renders a flat array directly. Instead, documents are transformed into folder groups derived from `folderPath`.
- Each folder group owns:
  - folder label
  - grouped file items
  - expanded or collapsed state
  - a folder-level remove action
- File rows remain clickable for preview selection but do not expose destructive actions.

### Backend

The backend upload route accepts the uploaded files plus ordered relative-path metadata.

- The upload request includes:
  - `files`
  - an ordered metadata payload describing each file's `relativePath`
- The backend validates that each uploaded item is a `.docx`.
- The backend persists relative path data per file record.
- The workbench snapshot includes `relativePath` and `folderPath` in each document payload.
- A new folder-removal endpoint removes all files belonging to a folder and returns an updated workbench snapshot.

## Data Model

### Frontend Types

Extend local preview and API-backed document types with:

- `relativePath: string | null`
- `folderPath: string | null`

Derivation rules:

- `relativePath` is the browser-provided folder-relative path, such as `investors/seed_round/SAFE_A.docx`
- `folderPath` is the directory portion of `relativePath`
- If a file has no directory metadata, `folderPath` resolves to a default group such as `Root`

### Backend Persistence

Add a persisted relative-path field to the `files` table and corresponding payloads.

Recommended fields:

- `relative_path TEXT`

Payload fields returned to the frontend:

- `relativePath`
- `folderPath`

`folderPath` may be computed from `relative_path` at read time instead of being stored separately.

## API Design

### Upload

The existing upload route remains the entry point:

- `POST /api/cases/:caseId/files`

Request body:

- multipart `files`
- ordered metadata field for paths, such as a JSON array aligned to file order

Example conceptual shape:

```json
[
  { "fileName": "SAFE_A.docx", "relativePath": "investors/seed_round/SAFE_A.docx" },
  { "fileName": "SAFE_B.docx", "relativePath": "investors/seed_round/SAFE_B.docx" }
]
```

An ordered array is preferred over a filename-keyed map because duplicate basenames are valid when relative paths differ.

### Folder Removal

Add a backend endpoint for persistent folder-level removal.

Recommended route:

- `POST /api/cases/:caseId/folders/remove`

Request body:

```json
{
  "folderPath": "investors/seed_round"
}
```

Response body:

- updated `workbench` snapshot
- removed file count
- optional failure details if partial deletion is ever introduced

Using a body-based route is safer than encoding folder paths directly in the URL because folder paths may contain `/`.

## Files Panel UX

### Grouping

The `Files` panel becomes a folder-grouped list.

- Top-level rows represent folders.
- Each folder row shows:
  - folder name
  - file count
  - expand/collapse control
  - remove-folder action
- Expanding a folder reveals file items contained in that folder.
- File items can be selected for preview but cannot be deleted.

Files without folder metadata are grouped under `Root`.

### Selection Behavior

- File selection remains file-based.
- Folder rows are not preview targets.
- If the selected file is removed because its folder is removed, selection moves to the next available file.
- If no files remain, the preview selection is cleared.

### Removal Rules

- Remove the existing file-level delete button entirely.
- Only folders expose destructive actions.
- Folder removal deletes all files within that folder from the current workbench.
- This is a durable backend mutation, not a frontend-only hide action.

## Confirmation Modal

Folder removal must be confirmed through a custom modal, not `window.confirm()`.

### Visual Style

The modal should match the existing application style:

- dark surface
- soft border
- rounded corners
- subtle blur
- orange accent for neutral emphasis
- danger-colored confirm action

### English UI Copy

Suggested copy:

- Title: `Remove Folder`
- Body: `This will remove all DOCX files in this folder from the current workspace. Files cannot be restored individually.`
- Secondary metadata: folder name and file count
- Cancel action: `Cancel`
- Confirm action: `Remove Folder`

### Behavior

- Opening the modal does not change the active preview.
- Confirm enters a loading state until the backend responds.
- Success closes the modal and refreshes grouped file state from the returned workbench snapshot.
- Failure keeps the modal open and shows an English error message.

## Error Handling

### Upload

- If the selected folder contains no `.docx` files, the frontend blocks submission and shows English feedback.
- If the folder contains mixed file types, the frontend ignores non-DOCX files and shows English feedback such as `Only DOCX files were uploaded.`
- Backend validation remains in place as a second line of defense.

### Removal

- If folder removal fails, the modal remains visible and the user sees a clear English failure message.
- Frontend should not optimistically remove the folder before the server confirms success.

## Testing Strategy

### Frontend Verification

- Upload a folder containing only `.docx` files and confirm grouped rendering.
- Upload a mixed folder and confirm non-DOCX files are ignored with English feedback.
- Confirm files remain previewable from within folder groups.
- Confirm no file-level delete action is visible.
- Confirm folder expand/collapse state works.
- Confirm removing a folder updates selection correctly.
- Confirm modal loading and error states render correctly.

### Backend Verification

- Confirm upload persists `relativePath`.
- Confirm workbench snapshot returns `relativePath` and `folderPath`.
- Confirm folder removal deletes all documents matching the target folder path.
- Confirm a refresh after deletion does not restore removed files.

## Risks and Mitigations

- Duplicate basenames across folders: use ordered path metadata rather than filename-keyed mapping.
- Missing browser folder metadata in non-folder uploads: fall back to `Root`.
- Partial UI/server mismatch during rollout: keep backend response authoritative and rebuild grouping from returned workbench data after mutations.
- Overly aggressive deletion: require modal confirmation and show folder name plus file count before confirm.

## Implementation Notes

- Keep chat responses to the user in Chinese.
- Keep all new UI copy in English.
- Do not redesign the upload entry controls in this pass; only add capability and supporting data structures.
- Remove file-level delete affordances from both local-upload and server-backed file rows.

## Acceptance Criteria

- A user can upload a folder and only `.docx` files are accepted.
- Folder-relative paths persist across refreshes.
- The `Files` panel shows collapsible folder groups instead of a flat list.
- Files inside a folder are selectable but not individually removable.
- A folder can be removed only through a styled custom confirmation modal.
- Folder removal persists on the backend and survives refresh.
- All newly introduced UI text is English.
