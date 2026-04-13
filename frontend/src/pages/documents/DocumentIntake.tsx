import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Calendar, FileText, Tag, UploadCloud } from "lucide-react";
import { useWorkbench } from "../../context/WorkbenchContext";
import { cn } from "../../utils/cn";

type IndexedDocument = {
  source_file: string;
  document_title: string;
  document_type: string;
  key_dates: Array<{
    date_original?: string;
    date_iso?: string | null;
    meaning?: string;
  }>;
  main_parties: Array<{
    name?: string;
    role?: string;
  }>;
  confidence: number;
  status: string;
  output_file: string;
};

type DocumentIndex = {
  document_count: number;
  documents: IndexedDocument[];
};

const API_BASE_URL =
  (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ??
  "http://127.0.0.1:8000";

export function DocumentIntake() {
  const { snapshot, endpoints } = useWorkbench();
  const workspaceDocuments = useMemo(() => snapshot?.documents ?? [], [snapshot]);
  const previews = useMemo(() => snapshot?.documentPreviews ?? [], [snapshot]);
  const [processedDocuments, setProcessedDocuments] = useState<IndexedDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(previews[0]?.documentId ?? workspaceDocuments[0]?.id ?? "");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoadingProcessed, setIsLoadingProcessed] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedPreview =
    previews.find((preview) => preview.documentId === selectedDocumentId) ?? previews[0] ?? null;

  useEffect(() => {
    void loadProcessedDocuments();
  }, []);

  useEffect(() => {
    if (!selectedDocumentId && (previews[0]?.documentId || workspaceDocuments[0]?.id)) {
      setSelectedDocumentId(previews[0]?.documentId ?? workspaceDocuments[0]?.id ?? "");
    }
  }, [previews, selectedDocumentId, workspaceDocuments]);

  const groupedDocuments = useMemo(() => {
    const groups = new Map<string, typeof workspaceDocuments>();

    workspaceDocuments
      .slice()
      .sort((a, b) => (a.transactionDate ?? a.uploadedAt).localeCompare(b.transactionDate ?? b.uploadedAt))
      .forEach((document) => {
        const key = document.transactionDate ?? "Undated";
        const group = groups.get(key) ?? [];
        group.push(document);
        groups.set(key, group);
      });

    return Array.from(groups.entries());
  }, [workspaceDocuments]);

  const selectedLabel = useMemo(() => {
    if (selectedFiles.length === 0) {
      return "DOCX transaction documents";
    }
    if (selectedFiles.length === 1) {
      return selectedFiles[0].name;
    }
    return `${selectedFiles.length} documents selected`;
  }, [selectedFiles]);

  const loadProcessedDocuments = async () => {
    setIsLoadingProcessed(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents`);
      if (!response.ok) {
        throw new Error(`Failed to load processed documents (${response.status})`);
      }
      const data = (await response.json()) as DocumentIndex;
      setProcessedDocuments(data.documents ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load processed documents");
    } finally {
      setIsLoadingProcessed(false);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) =>
      file.name.toLowerCase().endsWith(".docx"),
    );
    setSelectedFiles(files);
    setMessage(null);
    setError(files.length === 0 && event.target.files?.length ? "Only .docx files are supported" : null);
  };

  const uploadSelectedFiles = async () => {
    if (!selectedFiles.length) {
      inputRef.current?.click();
      return;
    }

    setIsUploading(true);
    setMessage(null);
    setError(null);

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = data?.failures?.[0]?.error ?? data?.detail ?? `Upload failed (${response.status})`;
        throw new Error(detail);
      }
      setProcessedDocuments(data.index?.documents ?? []);
      setSelectedFiles([]);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      setMessage(`${data.processed?.length ?? 0} document(s) saved and processed`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const renderHighlightedExcerpt = () => {
    if (!selectedPreview) {
      return null;
    }

    const highlight = selectedPreview.highlightedPhrases[0];
    if (!highlight || !selectedPreview.excerpt.includes(highlight.text)) {
      return <span>{selectedPreview.excerpt}</span>;
    }

    const [before, after] = selectedPreview.excerpt.split(highlight.text);

    return (
      <span>
        {before}
        <span className="rounded-lg bg-orange-400/18 px-1 py-0.5 text-white shadow-[0_0_0_1px_rgba(255,179,120,0.12)]">
          {highlight.text}
        </span>
        {after}
      </span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <section className="rounded-[34px] border border-orange-300/18 bg-white/[0.06] p-8 shadow-[0_24px_64px_rgba(0,0,0,0.36)] backdrop-blur-xl">
        <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-[30px] border border-dashed border-orange-300/30 bg-black/20 p-8 transition duration-200 hover:border-orange-200/45 hover:bg-white/[0.05]">
            <input
              ref={inputRef}
              className="hidden"
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple
              onChange={onFileChange}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-14 w-14 items-center justify-center rounded-3xl bg-orange-500/12 text-orange-200 transition hover:bg-orange-500/18"
            >
              <UploadCloud className="h-7 w-7" />
            </button>
            <h3 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-white">
              Drop the full transaction file set here
            </h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/58">
              Original DOCX files are saved to data_process, then parsed into processed_data for evidence review.
            </p>
            <div className="mt-5 text-sm font-medium text-white/72">{selectedLabel}</div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isUploading}
                onClick={uploadSelectedFiles}
                className="rounded-full border border-orange-300/30 bg-orange-500/12 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-orange-500/18 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isUploading ? "Processing..." : selectedFiles.length ? "Save and process" : "Select files"}
              </button>
              <button
                type="button"
                onClick={() => void loadProcessedDocuments()}
                className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white/55 transition hover:bg-white/[0.08]"
              >
                Refresh processed data
              </button>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white/55">
                Reserved API: {endpoints.uploadFiles}
              </span>
            </div>
            {(message || error) && (
              <div
                className={cn(
                  "mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
                  error
                    ? "border-rose-300/20 bg-rose-500/10 text-rose-100"
                    : "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
                )}
              >
                {error && <AlertCircle className="h-4 w-4" />}
                {error ?? message}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
            <MetricCard label="Saved originals" value={processedDocuments.length} caption="files processed locally" />
            <MetricCard label="Sorted by time" value={groupedDocuments.length} caption="dated groups ready for review" />
            <MetricCard
              label="Pipeline status"
              value={isLoadingProcessed ? "Loading" : "Ready"}
              caption="non-LLM preprocessing by default"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr,0.9fr]">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.26em] text-white/35">Pipeline output</div>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                Saved and processed documents
              </h3>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/58">
              {processedDocuments.length} files
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {isLoadingProcessed ? (
              <div className="rounded-[24px] border border-white/10 bg-black/18 p-5 text-sm text-white/55">
                Loading processed data...
              </div>
            ) : processedDocuments.length ? (
              processedDocuments.map((doc) => (
                <div key={`${doc.source_file}-${doc.output_file}`} className="rounded-[24px] border border-white/10 bg-black/18 p-4">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-white/8 p-3 text-orange-200">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{doc.source_file}</div>
                      <div className="mt-1 text-sm text-white/48">{doc.document_title || "Untitled"}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <PipelinePill icon={<Tag className="h-3.5 w-3.5" />} label={doc.document_type || "Pending type"} />
                        <PipelinePill icon={<Calendar className="h-3.5 w-3.5" />} label={formatKeyDate(doc)} />
                        <PipelinePill label={formatParties(doc)} />
                      </div>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/58">
                      {doc.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-white/10 bg-black/18 p-5 text-sm text-white/55">
                No processed documents yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.26em] text-white/35">Live document view</div>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                Source excerpt with highlighted origin
              </h3>
            </div>
            <span className="rounded-full border border-orange-300/20 bg-orange-500/10 px-4 py-2 text-xs font-medium text-orange-100/80">
              realtime preview
            </span>
          </div>

          <div className="mt-6 rounded-[28px] border border-white/10 bg-black/18 p-5">
            <div className="text-sm font-semibold text-white">
              {selectedPreview?.title ?? "Select a document below"}
            </div>
            <p className="mt-4 text-sm leading-7 text-white/68">{renderHighlightedExcerpt()}</p>
          </div>

          <div className="mt-5 space-y-3">
            {groupedDocuments.map(([date, group]) => (
              <div key={date} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                  <Calendar className="h-4 w-4 text-orange-200" />
                  {date}
                </div>
                <div className="space-y-2">
                  {group.map((document) => (
                    <button
                      key={document.id}
                      onClick={() => setSelectedDocumentId(document.id)}
                      className={cn(
                        "w-full rounded-[18px] border px-3 py-3 text-left transition duration-200",
                        selectedDocumentId === document.id
                          ? "border-orange-300/35 bg-orange-500/12"
                          : "border-white/8 bg-white/[0.03] hover:border-white/12 hover:bg-white/[0.06]",
                      )}
                    >
                      <div className="text-sm font-semibold text-white">{document.fileName}</div>
                      <div className="mt-1 text-sm text-white/48">{document.summary}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </motion.div>
  );
}

function MetricCard({ label, value, caption }: { label: string; value: string | number; caption: string }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-black/22 p-5">
      <div className="text-[11px] uppercase tracking-[0.24em] text-white/35">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm text-white/55">{caption}</div>
    </div>
  );
}

function PipelinePill({ icon, label }: { icon?: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/62">
      {icon}
      {label}
    </span>
  );
}

function formatKeyDate(doc: IndexedDocument) {
  const firstDate = doc.key_dates?.[0];
  return firstDate?.date_iso ?? firstDate?.date_original ?? "Pending date";
}

function formatParties(doc: IndexedDocument) {
  if (!doc.main_parties?.length) {
    return "Pending parties";
  }
  return doc.main_parties
    .slice(0, 2)
    .map((party) => party.name || party.role)
    .filter(Boolean)
    .join(", ");
}
