import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, FileText, Tag, UploadCloud } from "lucide-react";
import { useWorkbench } from "../../context/WorkbenchContext";
import { cn } from "../../utils/cn";

export function DocumentIntake() {
  const { snapshot, endpoints } = useWorkbench();
  const documents = useMemo(() => snapshot?.documents ?? [], [snapshot]);
  const previews = useMemo(() => snapshot?.documentPreviews ?? [], [snapshot]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(previews[0]?.documentId ?? documents[0]?.id ?? "");
  const selectedPreview =
    previews.find((preview) => preview.documentId === selectedDocumentId) ?? previews[0] ?? null;
  const groupedDocuments = useMemo(() => {
    const groups = new Map<string, typeof documents>();

    documents
      .slice()
      .sort((a, b) => (a.transactionDate ?? a.uploadedAt).localeCompare(b.transactionDate ?? b.uploadedAt))
      .forEach((document) => {
        const key = document.transactionDate ?? "Undated";
        const group = groups.get(key) ?? [];
        group.push(document);
        groups.set(key, group);
      });

    return Array.from(groups.entries());
  }, [documents]);

  const renderHighlightedExcerpt = () => {
    if (!selectedPreview) {
      return null;
    }

    const highlight = selectedPreview.highlightedPhrases[0];

    if (!highlight) {
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
          <div className="cursor-pointer rounded-[30px] border border-dashed border-orange-300/30 bg-black/20 p-8 transition duration-200 hover:border-orange-200/45 hover:bg-white/[0.05]">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-orange-500/12 text-orange-200">
              <UploadCloud className="h-7 w-7" />
            </div>
            <h3 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-white">
              Drop the full transaction file set here
            </h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/58">
              PDFs, Word files, and spreadsheets are sorted by date and category as soon as they land in the workspace.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="rounded-full border border-orange-300/30 bg-orange-500/12 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-orange-500/18">
                Select files
              </button>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white/55">
                Reserved API: {endpoints.uploadFiles}
              </span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[28px] border border-white/10 bg-black/22 p-5">
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/35">Sorted by time</div>
              <div className="mt-3 text-3xl font-semibold text-white">{groupedDocuments.length}</div>
              <div className="mt-2 text-sm text-white/55">dated groups ready for review</div>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-black/22 p-5">
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/35">Sorted by type</div>
              <div className="mt-3 text-3xl font-semibold text-white">
                {new Set(documents.map((document) => document.fileType)).size}
              </div>
              <div className="mt-2 text-sm text-white/55">document categories detected</div>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-black/22 p-5">
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/35">Ready next</div>
              <div className="mt-3 text-lg font-semibold text-white">Step 2 evidence review</div>
              <div className="mt-2 text-sm text-white/55">highlighted excerpts already linked to their sources</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr,0.9fr]">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.26em] text-white/35">Step 1</div>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                Organize by date and category
              </h3>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/58">
              {documents.length} files in scope
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {groupedDocuments.map(([date, group]) => (
              <div key={date} className="rounded-[28px] border border-white/10 bg-black/18 p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                  <Calendar className="h-4 w-4 text-orange-200" />
                  {date}
                </div>
                <div className="space-y-3">
                  {group.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDocumentId(doc.id)}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-[22px] border px-4 py-4 text-left transition duration-200",
                        selectedDocumentId === doc.id
                          ? "border-orange-300/35 bg-orange-500/12"
                          : "border-white/8 bg-white/[0.03] hover:border-white/12 hover:bg-white/[0.06]",
                      )}
                    >
                      <div className="rounded-2xl bg-white/8 p-3 text-orange-200">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">{doc.fileName}</div>
                        <div className="mt-1 text-sm text-white/48">{doc.summary}</div>
                      </div>
                      <div className="flex flex-col gap-2 text-right">
                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/58">
                          {doc.fileType.replace(/_/g, " ")}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]",
                            doc.evidenceStatus === "verified"
                              ? "bg-emerald-500/12 text-emerald-200"
                              : doc.evidenceStatus === "conflict"
                                ? "bg-amber-500/12 text-amber-200"
                                : doc.evidenceStatus === "rejected"
                                  ? "bg-rose-500/12 text-rose-200"
                                  : "bg-white/[0.08] text-white/55",
                          )}
                        >
                          {doc.evidenceStatus}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
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
              {selectedPreview?.title ?? "Select a document on the left"}
            </div>
            <p className="mt-4 text-sm leading-7 text-white/68">{renderHighlightedExcerpt()}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {(selectedPreview?.highlightedPhrases ?? []).map((phrase) => (
                <span
                  key={`${phrase.sourceLabel}-${phrase.text}`}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    phrase.tone === "good"
                      ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
                      : phrase.tone === "bad"
                        ? "border-amber-300/25 bg-amber-500/10 text-amber-100"
                        : "border-white/10 bg-white/[0.06] text-white/72",
                  )}
                >
                  {phrase.sourceLabel}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {documents
              .filter((document) => document.id === selectedPreview?.documentId)
              .map((document) => (
                <div key={document.id} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Tag className="h-4 w-4 text-orange-200" />
                    {document.fileName}
                  </div>
                  <div className="mt-3 text-sm text-white/55">
                    Stored as <span className="text-white/80">{document.sourcePath}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>
    </motion.div>
  );
}
