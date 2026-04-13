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
import {
  ArrowUpRight,
  GitBranchPlus,
  History,
  MessageSquare,
  PanelRightOpen,
  Send,
  Sparkles,
} from "lucide-react";
import { useWorkbench } from "../../context/WorkbenchContext";
import { cn } from "../../utils/cn";

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
  const [leftPaneWidth, setLeftPaneWidth] = useState(320);
  const [rightPaneWidth, setRightPaneWidth] = useState(340);
  const [historyPaneHeight, setHistoryPaneHeight] = useState(220);
  const [resizeMode, setResizeMode] = useState<"left" | "right" | "history" | null>(null);
  const [topologyOpen, setTopologyOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const rightPaneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedDocumentId && documents[0]) {
      setSelectedDocumentId(documents[0].id);
    }
  }, [documents, selectedDocumentId]);

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

  const activeDocument = documents.find((document) => document.id === selectedDocumentId) ?? documents[0] ?? null;
  const activePreview =
    previews.find((preview) => preview.documentId === activeDocument?.id) ?? previews[0] ?? null;
  const activeComparison =
    comparisons.find((comparison) => comparison.currentDocumentId === activeDocument?.id) ??
    comparisons.find((comparison) => comparison.previousDocumentId === activeDocument?.id) ??
    comparisons[0] ??
    null;
  const activeChange = activeComparison?.changes[0] ?? null;
  const statusCounts = useMemo(
    () => ({
      conflicts: documents.filter((document) => document.evidenceStatus === "conflict").length,
      verified: documents.filter((document) => document.evidenceStatus === "verified").length,
    }),
    [documents],
  );

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
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-orange-500/12 p-3 text-orange-100">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-white">AI chat</div>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/45">
              Online
            </span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            <div className="rounded-[18px] border border-white/8 bg-black/18 p-3 text-sm leading-6 text-white/72">
              I loaded the latest file set and connected each cap table entry to a source clause.
            </div>
            <div className="rounded-[18px] border border-orange-300/18 bg-orange-500/10 p-3 text-sm leading-6 text-white">
              The current blocker is still the missing stockholder consent in the approval package.
            </div>
            <div className="rounded-[18px] border border-white/8 bg-black/18 p-3 text-sm leading-6 text-white/72">
              Ask me what changed, whether the latest edit should be accepted, or why the current version branched.
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

        <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-white/[0.03]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-orange-200/70">
                {activeDocument?.fileName ?? "Document"}
              </div>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
                {activeComparison?.title ?? activePreview?.title ?? "Document compare"}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTopologyOpen(true)}
                className="flex items-center gap-2 rounded-full border border-orange-300/18 bg-orange-500/10 px-4 py-2 text-sm text-white transition hover:bg-orange-500/16 active:scale-95"
              >
                <PanelRightOpen className="h-4 w-4 text-orange-200" />
                Topology
              </button>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/48">
                {statusCounts.conflicts} conflicts
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="grid min-h-full grid-rows-[420px_minmax(190px,auto)]">
            <div className="grid min-h-0 grid-cols-2 border-b border-white/10">
              <div className="min-h-0 border-r border-white/10 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">Previous</div>
                  <span className="text-xs text-white/35">
                    {activeComparison?.changes[0]?.sourceLabel ?? activePreview?.highlightedPhrases[0]?.sourceLabel}
                  </span>
                </div>
                <div className="h-full overflow-y-auto rounded-[18px] border border-white/8 bg-black/18 p-4 text-sm leading-6 text-white/60">
                  {activeChange?.previousText ?? activePreview?.excerpt ?? "No previous text loaded."}
                </div>
              </div>

              <div className="min-h-0 p-3">
                <div className="mb-2 flex items-center justify-between">
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
                <div className="h-full overflow-y-auto rounded-[18px] border border-orange-300/14 bg-orange-500/10 p-4 text-sm leading-6 text-white/84">
                  {activeChange?.currentText ?? renderExcerpt()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[0.9fr,1.1fr]">
              <div className="border-r border-white/10 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Sparkles className="h-4 w-4 text-orange-200" />
                  AI readout
                </div>
                <div className="mt-2 text-sm leading-6 text-white/62">
                  {activeComparison?.summary ?? activeDocument?.summary ?? "No summary loaded."}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(activePreview?.highlightedPhrases ?? []).map((phrase) => (
                    <span
                      key={`${phrase.sourceLabel}-${phrase.text}`}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs",
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

              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">Working cap table</div>
                  <span className="text-xs text-white/35">{currentVersion?.versionName}</span>
                </div>
                <div className="mt-2 grid gap-1.5">
                  {(currentVersion?.rows ?? []).slice(0, 4).map((row) => (
                    <div
                      key={`${row.holderName}-${row.securityType}`}
                      className="flex items-center justify-between rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2.5"
                    >
                      <div>
                        <div className="text-sm font-medium text-white">{row.holderName}</div>
                        <div className="text-xs text-white/42">{row.sourceLocation}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-white">{row.shares.toLocaleString()}</div>
                        <div className="text-xs text-white/42">{row.securityType}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </div>
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
            className="min-h-0 overflow-hidden border-b border-white/10"
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
            <div className="space-y-1.5 overflow-y-auto px-3 pb-3">
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

          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <GitBranchPlus className="h-4 w-4 text-orange-200" />
                Files
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/48">
                {documents.length}
              </span>
            </div>
            <div className="space-y-1.5 overflow-y-auto px-3 pb-3">
              {documents.map((document) => (
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
                      <div className="mt-1 text-xs text-white/40">
                        {document.transactionDate ?? document.uploadedAt.slice(0, 10)}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]",
                        document.evidenceStatus === "verified"
                          ? "bg-emerald-500/12 text-emerald-100"
                          : document.evidenceStatus === "conflict"
                            ? "bg-amber-500/12 text-amber-100"
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
