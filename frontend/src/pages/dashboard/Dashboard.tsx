import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
<<<<<<< HEAD
import JSZip from "jszip";
import * as docx from "docx-preview";
=======
>>>>>>> d6217bb02c26cbeca1dceb7b3e0d6972b6b514ad
import {
  ArrowUpRight,
  GitBranchPlus,
  History,
  MessageSquare,
  PanelRightOpen,
  Send,
<<<<<<< HEAD
  Upload,
=======
  Sparkles,
>>>>>>> d6217bb02c26cbeca1dceb7b3e0d6972b6b514ad
} from "lucide-react";
import { useWorkbench } from "../../context/WorkbenchContext";
import { cn } from "../../utils/cn";

<<<<<<< HEAD
interface UploadedPreviewDocument {
  id: string;
  fileName: string;
  kind: "text" | "docx" | "pdf" | "image" | "unsupported";
  content: string;
  file?: File;
  objectUrl?: string;
  uploadedAt: string;
  summary: string;
}

function DocxViewer({ file }: { file: File }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current || !file) {
      return;
    }

    const renderDocx = async () => {
      try {
        await docx.renderAsync(file, containerRef.current!, undefined, {
          className: "docx-preview-wrapper",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          trimXmlDeclaration: true,
          debug: false,
        });
      } catch (error) {
        console.error("Failed to render DOCX:", error);
      }
    };

    void renderDocx();
  }, [file]);

  const handleSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0 && containerRef.current?.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      setSelectionRect({
        top: rect.top - containerRect.top,
        left: rect.left - containerRect.left,
        width: rect.width,
      });
    } else {
      setSelectionRect(null);
    }
  };

  const applyHighlight = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const span = document.createElement("span");
    span.className = "bg-orange-300/40 border-b-2 border-orange-500 rounded-sm";

    try {
      range.surroundContents(span);
      selection.removeAllRanges();
      setSelectionRect(null);
    } catch (e) {
      console.error("Could not highlight across multiple nodes", e);
      // For complex multi-node selections, a more advanced range-wrapping library would be needed.
      // But this handles standard text block highlighting out of the box.
      alert("Please select text within a single paragraph to highlight.");
    }
  };

  return (
    <div className="relative w-full">
      <div
        ref={containerRef}
        onMouseUp={handleSelection}
        className="docx-viewer-container w-full overflow-hidden rounded-[12px] bg-white text-black [&_.docx-preview-wrapper]:!bg-white [&_.docx-preview-wrapper]:!p-8 [&_section]:!shadow-none [&_section]:!bg-white [&_section]:!min-h-0 [&_section]:!h-auto"
      />
      
      <AnimatePresence>
        {selectionRect ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              position: "absolute",
              top: Math.max(0, selectionRect.top - 40),
              left: selectionRect.left + selectionRect.width / 2 - 40,
            }}
            className="z-50"
          >
            <button
              onClick={applyHighlight}
              className="flex items-center gap-1.5 rounded-full border border-orange-300/20 bg-black/80 px-3 py-1.5 text-xs font-medium text-orange-200 shadow-xl backdrop-blur-md transition hover:bg-black hover:text-orange-100"
            >
              Highlight
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

=======
>>>>>>> d6217bb02c26cbeca1dceb7b3e0d6972b6b514ad
export function Dashboard() {
  const { snapshot, setViewingVersion } = useWorkbench();
  const documents = useMemo(() => snapshot?.documents ?? [], [snapshot]);
  const comparisons = useMemo(() => snapshot?.documentComparisons ?? [], [snapshot]);
  const previews = useMemo(() => snapshot?.documentPreviews ?? [], [snapshot]);
  const topologyNodes = useMemo(() => snapshot?.topology.nodes ?? [], [snapshot]);
  const topologyRefs = useMemo(() => snapshot?.topology.refs ?? [], [snapshot]);
  const versionNodes = useMemo(
    () => topologyNodes.filter((node) => node.nodeType === "captable_version"),
    [topologyNodes],
  );
  const currentVersion = snapshot?.captableVersions.find(
    (version) => version.topologyNodeId === snapshot.topology.currentViewingNodeId,
  );
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
<<<<<<< HEAD
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedPreviewDocument[]>([]);
  const [leftPaneWidth, setLeftPaneWidth] = useState(260);
  const [rightPaneWidth, setRightPaneWidth] = useState(280);
=======
  const [leftPaneWidth, setLeftPaneWidth] = useState(320);
  const [rightPaneWidth, setRightPaneWidth] = useState(340);
>>>>>>> d6217bb02c26cbeca1dceb7b3e0d6972b6b514ad
  const [historyPaneHeight, setHistoryPaneHeight] = useState(220);
  const [resizeMode, setResizeMode] = useState<"left" | "right" | "history" | null>(null);
  const [topologyOpen, setTopologyOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const rightPaneRef = useRef<HTMLDivElement | null>(null);

  const documentItems = useMemo(
    () => [
      ...uploadedDocuments.map((document) => ({
        id: document.id,
        fileName: document.fileName,
        uploadedAt: document.uploadedAt,
        evidenceStatus: "uploaded" as const,
        summary: document.summary,
        isUpload: true,
      })),
      ...documents.map((document) => ({
        id: document.id,
        fileName: document.fileName,
        uploadedAt: document.transactionDate ?? document.uploadedAt.slice(0, 10),
        evidenceStatus: document.evidenceStatus,
        summary: document.summary,
        isUpload: false,
      })),
    ],
    [documents, uploadedDocuments],
  );

  useEffect(() => {
    if (!selectedDocumentId && documentItems[0]) {
      setSelectedDocumentId(documentItems[0].id);
    }
  }, [documentItems, selectedDocumentId]);

  useEffect(() => {
    return () => {
      uploadedDocuments.forEach((document) => {
        if (document.objectUrl) {
          URL.revokeObjectURL(document.objectUrl);
        }
      });
    };
  }, [uploadedDocuments]);

  useEffect(() => {
    if (!resizeMode) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const workspace = workspaceRef.current?.getBoundingClientRect();
      const rightPane = rightPaneRef.current?.getBoundingClientRect();

      if (!workspace) {
        return;
      }

      if (resizeMode === "left") {
        const next = Math.min(Math.max(event.clientX - workspace.left, 260), 460);
        setLeftPaneWidth(next);
      }

      if (resizeMode === "right") {
        const next = Math.min(Math.max(workspace.right - event.clientX, 280), 440);
        setRightPaneWidth(next);
      }

      if (resizeMode === "history" && rightPane) {
        const next = Math.min(Math.max(event.clientY - rightPane.top, 160), rightPane.height - 220);
        setHistoryPaneHeight(next);
      }
    };

    const handleUp = () => setResizeMode(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    document.body.style.cursor =
      resizeMode === "history" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizeMode]);

  const extractDocxText = useCallback(async (file: File) => {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file("word/document.xml")?.async("string");

    if (!xml) {
      return "Unable to read the DOCX body.";
    }

    const parsed = new DOMParser().parseFromString(xml, "application/xml");
    const text = Array.from(parsed.getElementsByTagName("w:t"))
      .map((node) => node.textContent ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return text || "The DOCX file does not contain readable body text.";
  }, []);

  const buildUploadedPreview = useCallback(
    async (file: File): Promise<UploadedPreviewDocument> => {
      const lowerName = file.name.toLowerCase();
      const id = `upload-${crypto.randomUUID()}`;
      const uploadedAt = new Date().toISOString().slice(0, 10);

      if (/\.(txt|md|csv|json|ts|tsx|js|jsx|py|sql)$/i.test(lowerName)) {
        const content = await file.text();
        return {
          id,
          fileName: file.name,
          kind: "text",
          content,
          uploadedAt,
          summary: "Local text preview loaded.",
        };
      }

      if (/\.docx$/i.test(lowerName)) {
        const content = await extractDocxText(file);
        return {
          id,
          fileName: file.name,
          kind: "docx",
          content,
          file,
          uploadedAt,
          summary: "DOCX document loaded for preview.",
        };
      }

      if (/\.pdf$/i.test(lowerName)) {
        return {
          id,
          fileName: file.name,
          kind: "pdf",
          content: "",
          objectUrl: URL.createObjectURL(file),
          uploadedAt,
          summary: "PDF preview loaded.",
        };
      }

      if (/\.(png|jpg|jpeg|gif|webp)$/i.test(lowerName)) {
        return {
          id,
          fileName: file.name,
          kind: "image",
          content: "",
          objectUrl: URL.createObjectURL(file),
          uploadedAt,
          summary: "Image preview loaded.",
        };
      }

      return {
        id,
        fileName: file.name,
        kind: "unsupported",
        content: "",
        uploadedAt,
        summary: "Preview is not supported for this file type yet.",
      };
    },
    [extractDocxText],
  );

  const handleFiles = useCallback(
    async (input: FileList | File[]) => {
      const files = Array.from(input);

      if (files.length === 0) {
        return;
      }

      const nextDocuments = await Promise.all(files.map((file) => buildUploadedPreview(file)));
      setUploadedDocuments((current) => [...nextDocuments, ...current]);
      setSelectedDocumentId(nextDocuments[0].id);
      setIsDraggingFiles(false);
    },
    [buildUploadedPreview],
  );

  const activeUploadedDocument =
    uploadedDocuments.find((document) => document.id === selectedDocumentId) ?? null;
  const activeDocument = documents.find((document) => document.id === selectedDocumentId) ?? documents[0] ?? null;
  const activePreview =
    previews.find((preview) => preview.documentId === activeDocument?.id) ?? previews[0] ?? null;
  const activeComparison =
    comparisons.find((comparison) => comparison.currentDocumentId === activeDocument?.id) ??
    comparisons.find((comparison) => comparison.previousDocumentId === activeDocument?.id) ??
    comparisons[0] ??
    null;
  const activeChange = activeComparison?.changes[0] ?? null;
  const renderExcerpt = () => {
    if (!activePreview) {
      return "Select a document from the right panel.";
    }

    const phrase = activePreview.highlightedPhrases[0];

    if (!phrase || !activePreview.excerpt.includes(phrase.text)) {
      return activePreview.excerpt;
    }

    const [before, after] = activePreview.excerpt.split(phrase.text);

    return (
      <>
        {before}
        <span className="rounded-lg bg-orange-400/18 px-1 py-0.5 text-white">
          {phrase.text}
        </span>
        {after}
      </>
    );
  };

  const flowNodes = useMemo<Node[]>(() => {
    return topologyNodes.map((node) => ({
      id: node.id,
      position: {
        x: node.depth * 220 + 40,
        y: node.index * 120 + 40,
      },
      data: { label: node.label },
      style: {
        borderRadius: 18,
        padding: 12,
        width: 180,
        border:
          snapshot?.topology.currentViewingNodeId === node.id
            ? "1px solid rgba(255,181,120,0.7)"
            : "1px solid rgba(255,255,255,0.12)",
        background:
          snapshot?.topology.currentViewingNodeId === node.id
            ? "rgba(255,132,33,0.16)"
            : "rgba(255,255,255,0.06)",
        color: "#ffffff",
        fontSize: 12,
      },
    }));
  }, [snapshot?.topology.currentViewingNodeId, topologyNodes]);

  const flowEdges = useMemo<Edge[]>(() => {
    const parentEdges = topologyNodes
      .filter((node) => node.parentId)
      .map((node) => ({
        id: `${node.parentId}-${node.id}`,
        source: node.parentId!,
        target: node.id,
        type: "smoothstep" as const,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#f3a15d" },
        style: { stroke: "#f3a15d", strokeWidth: 1.6, opacity: 0.85 },
      }));

    const refEdges = topologyRefs.map((ref) => ({
      id: `${ref.fromNodeId}-${ref.toNodeId}-${ref.refType}`,
      source: ref.fromNodeId,
      target: ref.toNodeId,
      type: "straight" as const,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#8f8f8f" },
      style: {
        stroke: ref.refType === "conflicts_with" ? "#ffb15b" : "#8f8f8f",
        strokeWidth: 1.2,
        strokeDasharray: ref.refType === "conflicts_with" ? "6 6" : "4 8",
        opacity: 0.65,
      },
    }));

    return [...parentEdges, ...refEdges];
  }, [topologyNodes, topologyRefs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <div
        ref={workspaceRef}
        className="flex h-full overflow-hidden rounded-[24px] border border-white/10 bg-black/25 shadow-[0_24px_64px_rgba(0,0,0,0.34)] backdrop-blur-xl"
      >
        <section
          className="flex h-full min-w-0 flex-col border-r border-white/10 bg-white/[0.04]"
          style={{ width: leftPaneWidth }}
        >
          <div className="border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-orange-500/12 p-3 text-orange-100">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-white">AI chat</div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
            <div className="flex flex-col items-start gap-1">
              <div className="rounded-[18px] rounded-tl-sm border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/80 max-w-[95%]">
                Hello! I'm VeriCap AI. I've loaded the workspace. What would you like to verify today?
              </div>
              <div className="text-[10px] text-white/30 ml-1">10:00 AM</div>
            </div>
            
            <div className="flex flex-col items-end gap-1">
              <div className="rounded-[18px] rounded-tr-sm border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm leading-6 text-orange-50 max-w-[95%]">
                Can you check if the Cap Table matches the latest SAFE documents?
              </div>
              <div className="text-[10px] text-white/30 mr-1">10:01 AM</div>
            </div>

            <div className="flex flex-col items-start gap-1">
              <div className="rounded-[18px] rounded-tl-sm border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/80 max-w-[95%]">
                I found a discrepancy. The Series Seed round in the Cap Table shows $2M raised, but the SAFE documents aggregate to $2.5M. I've highlighted the conflict in the document viewer.
              </div>
              <div className="text-[10px] text-white/30 ml-1">10:01 AM</div>
            </div>
          </div>

          <div className="border-t border-white/10 p-3">
            <div className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-2.5">
              <input
                value=""
                readOnly
                className="flex-1 bg-transparent text-sm text-white/35 outline-none"
                placeholder="Ask about the active document..."
              />
              <button className="rounded-full bg-orange-500/14 p-2.5 text-orange-100 transition hover:bg-orange-500/20 active:scale-95">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <div
          onPointerDown={(event) => {
            event.preventDefault();
            setResizeMode("left");
          }}
          className="group relative w-4 shrink-0 cursor-col-resize bg-transparent touch-none"
        >
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/10 transition group-hover:bg-orange-300/50" />
          <span className="absolute left-1/2 top-1/2 h-12 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 transition group-hover:bg-orange-300/60" />
        </div>

        <section
          className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-white/[0.03]"
          onDragOver={(event) => {
            event.preventDefault();
            setIsDraggingFiles(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) {
              setIsDraggingFiles(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDraggingFiles(false);
            void handleFiles(event.dataTransfer.files);
          }}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-orange-200/70">
                {activeUploadedDocument?.fileName ?? activeDocument?.fileName ?? "Document"}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".txt,.md,.csv,.json,.docx,.pdf,.png,.jpg,.jpeg,.gif,.webp"
                onChange={(event) => {
                  if (event.target.files) {
                    void handleFiles(event.target.files);
                  }
                  event.currentTarget.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white transition hover:bg-white/[0.08] active:scale-95"
              >
                <Upload className="h-4 w-4 text-orange-200" />
                Upload
              </button>
              <button
                onClick={() => setTopologyOpen(true)}
                className="flex items-center gap-2 rounded-full border border-orange-300/18 bg-orange-500/10 px-4 py-2 text-sm text-white transition hover:bg-orange-500/16 active:scale-95"
              >
                <PanelRightOpen className="h-4 w-4 text-orange-200" />
                Topology
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {activeUploadedDocument ? (
              <div className="min-h-full p-3">
                <div className="rounded-[18px] border border-white/10 bg-black/18 p-3">
                  <div className="rounded-[16px] border border-orange-300/14 bg-orange-500/10 p-4">
                    {activeUploadedDocument.kind === "pdf" && activeUploadedDocument.objectUrl ? (
                      <iframe
                        title={activeUploadedDocument.fileName}
                        src={activeUploadedDocument.objectUrl}
                        className="h-[900px] w-full rounded-[12px] bg-white"
                      />
                    ) : null}
                    {activeUploadedDocument.kind === "image" && activeUploadedDocument.objectUrl ? (
                      <img
                        src={activeUploadedDocument.objectUrl}
                        alt={activeUploadedDocument.fileName}
                        className="max-h-none w-full rounded-[12px] object-contain"
                      />
                    ) : null}
                    {activeUploadedDocument.kind === "docx" && activeUploadedDocument.file ? (
                      <DocxViewer file={activeUploadedDocument.file} />
                    ) : null}
                    {activeUploadedDocument.kind === "text" ? (
                      <pre className="min-h-[900px] whitespace-pre-wrap break-words font-sans text-sm leading-7 text-white/84">
                        {activeUploadedDocument.content}
                      </pre>
                    ) : null}
                    {activeUploadedDocument.kind === "unsupported" ? (
                      <div className="flex min-h-[320px] items-center justify-center text-sm text-white/58">
                        Preview is not available for this file type yet.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col min-h-full">
                <div className="grid min-h-0 h-[480px] shrink-0 grid-cols-2 border-b border-white/10">
                  <div className="flex flex-col min-h-0 border-r border-white/10 p-4">
                    <div className="mb-3 flex shrink-0 items-center justify-between">
                      <div className="text-sm font-semibold text-white">Previous</div>
                      <span className="text-xs text-white/35">
                        {activeComparison?.changes[0]?.sourceLabel ?? activePreview?.highlightedPhrases[0]?.sourceLabel}
                      </span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto rounded-[18px] border border-white/8 bg-black/18 p-5 text-[14.5px] leading-7 text-white/60">
                      {activeChange?.previousText ?? activePreview?.excerpt ?? "No previous text loaded."}
                    </div>
                  </div>

                  <div className="flex flex-col min-h-0 p-4">
                    <div className="mb-3 flex shrink-0 items-center justify-between">
                      <div className="text-sm font-semibold text-white">Current</div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]",
                          activeComparison?.assessment === "good"
                            ? "bg-emerald-500/12 text-emerald-100"
                            : activeComparison?.assessment === "bad"
                              ? "bg-rose-500/12 text-rose-100"
                              : "bg-amber-500/12 text-amber-100",
                        )}
                      >
                        {activeComparison?.assessment?.replace(/_/g, " ") ?? "live"}
                      </span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto rounded-[18px] border border-orange-300/14 bg-orange-500/10 p-5 text-[14.5px] leading-7 text-white/84">
                      {activeChange?.currentText ?? renderExcerpt()}
                    </div>
                  </div>
                </div>

                <div className="grid flex-1 grid-cols-[0.9fr,1.1fr]">
                  <div className="flex flex-col justify-center border-r border-white/10 p-6">
                    <div className="text-[14.5px] leading-relaxed text-white/70">
                      {activeComparison?.summary ?? activeDocument?.summary ?? "No summary loaded."}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {(activePreview?.highlightedPhrases ?? []).map((phrase) => (
                        <span
                          key={`${phrase.sourceLabel}-${phrase.text}`}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-medium",
                            phrase.tone === "good"
                              ? "border-emerald-300/22 bg-emerald-500/10 text-emerald-100"
                              : phrase.tone === "bad"
                                ? "border-amber-300/22 bg-amber-500/10 text-amber-100"
                                : "border-white/10 bg-white/[0.05] text-white/68",
                          )}
                        >
                          {phrase.sourceLabel}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col justify-center p-6">
                    <div className="mb-4 flex shrink-0 items-center justify-between">
                      <div className="text-sm font-semibold text-white">Cap table</div>
                      <span className="text-xs text-white/35">{currentVersion?.versionName}</span>
                    </div>
                    <div className="grid gap-2">
                      {(currentVersion?.rows ?? []).slice(0, 4).map((row) => (
                        <div
                          key={`${row.holderName}-${row.securityType}`}
                          className="flex items-center justify-between rounded-[16px] border border-white/8 bg-white/[0.03] px-4 py-3"
                        >
                          <div>
                            <div className="text-sm font-medium text-white">{row.holderName}</div>
                            <div className="mt-0.5 text-[11px] text-white/42">{row.sourceLocation}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-white">{row.shares.toLocaleString()}</div>
                            <div className="mt-0.5 text-[11px] text-white/42">{row.securityType}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {isDraggingFiles ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/72 backdrop-blur-sm">
                <div className="rounded-[24px] border border-orange-300/24 bg-orange-500/10 px-8 py-6 text-center">
                  <Upload className="mx-auto h-7 w-7 text-orange-200" />
                  <div className="mt-3 text-base font-semibold text-white">Drop files</div>
                </div>
              </div>
            ) : null}
          </div>

          <AnimatePresence>
            {topologyOpen ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 z-20 bg-black/80 backdrop-blur-xl"
              >
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                    <div className="flex items-center gap-2 text-white">
                      <History className="h-4 w-4 text-orange-200" />
                      Full topology
                    </div>
                    <button
                      onClick={() => setTopologyOpen(false)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex-1">
                    <ReactFlow
                      nodes={flowNodes}
                      edges={flowEdges}
                      fitView
                      fitViewOptions={{ padding: 0.18 }}
                      className="bg-[radial-gradient(circle_at_top_left,_rgba(255,123,0,0.08),_transparent_20%),linear-gradient(180deg,_#090909_0%,_#111111_100%)]"
                    >
                      <Background color="rgba(255,255,255,0.08)" gap={18} />
                      <Controls className="border border-white/10 bg-black/60 text-white" />
                    </ReactFlow>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>

        <div
          onPointerDown={(event) => {
            event.preventDefault();
            setResizeMode("right");
          }}
          className="group relative w-4 shrink-0 cursor-col-resize bg-transparent touch-none"
        >
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/10 transition group-hover:bg-orange-300/50" />
          <span className="absolute left-1/2 top-1/2 h-12 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 transition group-hover:bg-orange-300/60" />
        </div>

        <aside
          ref={rightPaneRef}
          className="flex h-full min-w-0 flex-col bg-white/[0.04]"
          style={{ width: rightPaneWidth }}
        >
          <div
            className="flex flex-col min-h-0 overflow-hidden border-b border-white/10"
            style={{ height: historyPaneHeight }}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <History className="h-4 w-4 text-orange-200" />
                History
              </div>
              <button
                onClick={() => setTopologyOpen(true)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/48"
              >
                Expand
              </button>
            </div>
            <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto px-3 pb-3">
              {versionNodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => void setViewingVersion(node.id)}
                  className={cn(
                    "w-full rounded-[16px] border px-3 py-2.5 text-left transition duration-200",
                    snapshot?.topology.currentViewingNodeId === node.id
                      ? "border-orange-300/32 bg-orange-500/12"
                      : "border-white/8 bg-black/18 hover:bg-white/[0.05]",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{node.label}</div>
                      <div className="mt-1 text-xs text-white/40">{node.status}</div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-white/35" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div
            onPointerDown={(event) => {
              event.preventDefault();
              setResizeMode("history");
            }}
            className="group relative h-4 shrink-0 cursor-row-resize bg-transparent touch-none"
          >
            <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10 transition group-hover:bg-orange-300/50" />
            <span className="absolute left-1/2 top-1/2 h-1.5 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 transition group-hover:bg-orange-300/60" />
          </div>

          <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <GitBranchPlus className="h-4 w-4 text-orange-200" />
                Files
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/48">
                {documentItems.length}
              </span>
            </div>
            <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto px-3 pb-3">
              {documentItems.map((document) => (
                <button
                  key={document.id}
                  onClick={() => setSelectedDocumentId(document.id)}
                  className={cn(
                    "w-full rounded-[16px] border px-3 py-2.5 text-left transition duration-200",
                    selectedDocumentId === document.id
                      ? "border-orange-300/32 bg-orange-500/12"
                      : "border-white/8 bg-black/18 hover:bg-white/[0.05]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{document.fileName}</div>
                      <div className="mt-1 text-xs text-white/40">{document.uploadedAt}</div>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]",
                        document.evidenceStatus === "verified"
                          ? "bg-emerald-500/12 text-emerald-100"
                          : document.evidenceStatus === "conflict"
                            ? "bg-amber-500/12 text-amber-100"
                            : document.evidenceStatus === "uploaded"
                              ? "bg-sky-500/12 text-sky-100"
                            : document.evidenceStatus === "rejected"
                              ? "bg-rose-500/12 text-rose-100"
                              : "bg-white/[0.08] text-white/55",
                      )}
                    >
                      {document.evidenceStatus}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </motion.div>
  );
}
