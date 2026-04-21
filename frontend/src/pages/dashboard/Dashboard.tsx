import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as docx from "docx-preview";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  LoaderCircle,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Send,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";
import { topologyApi } from "../../lib/api/topologyApi";
import { useWorkbench } from "../../context/WorkbenchContext";
import { cn } from "../../utils/cn";

interface UploadedPreviewDocument {
  id: string;
  fileName: string;
  kind: "docx" | "unsupported";
  file?: File;
  uploadedAt: string;
  summary: string;
  relativePath: string | null;
  folderPath: string;
}

interface DocumentListItem {
  id: string;
  fileName: string;
  uploadedAt: string;
  evidenceStatus: "uploaded" | "unverified" | "verified" | "conflict" | "rejected";
  summary: string;
  isUpload: boolean;
  relativePath: string | null;
  folderPath: string;
  identityKey: string;
}

interface DocumentFolderGroup {
  folderPath: string;
  documents: DocumentListItem[];
}

type RelativePathFile = File & {
  webkitRelativePath?: string;
};

type UploadStateStatus = "idle" | "uploading" | "success" | "partial_success" | "failed";

interface UploadState {
  status: UploadStateStatus;
  message: string | null;
  details: string[];
}

type WorkspaceSurfaceMode = "document" | "captable";

const ROOT_FOLDER_NAME = "Root";
const LEFT_PANEL_WIDTH = 312;
const RIGHT_PANEL_WIDTH = 332;
const COLLAPSED_RAIL_WIDTH = 68;
const PANEL_TRANSITION = { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const };
const PAGE_TRANSITION = { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };
const EMPTY_UPLOAD_STATE: UploadState = { status: "idle", message: null, details: [] };

function formatProjectionLabel(projection: string) {
  return projection.replace(/_/g, " ");
}

function formatReviewStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function getReviewStatusTone(status: string) {
  if (status === "approved" || status === "verified") {
    return "border-emerald-400/20 bg-emerald-500/12 text-emerald-100";
  }
  if (status === "rejected" || status === "conflict") {
    return "border-rose-400/20 bg-rose-500/12 text-rose-100";
  }
  return "border-amber-300/20 bg-amber-500/12 text-amber-100";
}

function getConfidenceTone(confidence: number) {
  if (confidence >= 0.8) {
    return "text-emerald-100";
  }
  if (confidence >= 0.65) {
    return "text-amber-100";
  }
  return "text-rose-100";
}

function normalizeRelativePath(relativePath?: string | null) {
  if (!relativePath) {
    return null;
  }
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
  return normalized || null;
}

function resolveFolderPath(relativePath?: string | null) {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized || !normalized.includes("/")) {
    return ROOT_FOLDER_NAME;
  }
  return normalized.split("/").slice(0, -1).join("/") || ROOT_FOLDER_NAME;
}

function getDocumentIdentity(fileName: string, relativePath?: string | null) {
  return normalizeRelativePath(relativePath) ?? fileName;
}

function getDocxPageNodes(container: HTMLElement) {
  const directPages = Array.from(container.querySelectorAll(".docx-wrapper > section"));
  if (directPages.length > 0) {
    return directPages as HTMLElement[];
  }

  return Array.from(container.querySelectorAll("section")) as HTMLElement[];
}

function ReaderSurface({
  children,
  contentClassName,
}: {
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex h-full w-full max-w-[1140px] min-w-0 flex-col rounded-[18px] border border-white/8 bg-[#101010] px-3 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.22)] md:px-4 md:py-4",
        contentClassName,
      )}
    >
      {children}
    </div>
  );
}

function DocxPageReader({
  documentKey,
  pageIndex,
  sourceFile,
  downloadUrl,
  onPageCountChange,
  onLoadingChange,
  onErrorChange,
}: {
  documentKey: string;
  pageIndex: number;
  sourceFile?: Blob | null;
  downloadUrl?: string | null;
  onPageCountChange: (count: number) => void;
  onLoadingChange: (isLoading: boolean) => void;
  onErrorChange: (message: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const syncActivePage = useCallback((nextPageIndex: number) => {
    if (!containerRef.current) {
      return;
    }

    const pages = getDocxPageNodes(containerRef.current);
    pages.forEach((page, index) => {
      const isActive = index === nextPageIndex;
      page.style.display = isActive ? "block" : "none";
      page.setAttribute("aria-hidden", isActive ? "false" : "true");
    });
  }, []);

  useEffect(() => {
    syncActivePage(pageIndex);
  }, [pageIndex, syncActivePage]);

  useEffect(() => {
    let isCancelled = false;
    const abortController = new AbortController();

    const renderDocument = async () => {
      if (!containerRef.current) {
        return;
      }

      const container = containerRef.current;
      container.innerHTML = "";
      onErrorChange(null);
      onPageCountChange(0);

      if (!sourceFile && !downloadUrl) {
        onLoadingChange(false);
        return;
      }

      onLoadingChange(true);

      try {
        let blob: Blob;

        if (sourceFile) {
          blob = sourceFile;
        } else {
          const response = await fetch(downloadUrl!, { signal: abortController.signal });
          if (!response.ok) {
            throw new Error(`Failed to download source document (${response.status})`);
          }
          blob = await response.blob();
        }

        if (isCancelled) {
          return;
        }

        await docx.renderAsync(await blob.arrayBuffer(), container, undefined, {
          className: "word-document-shell",
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          useBase64URL: true,
          experimental: true,
        });

        if (isCancelled) {
          return;
        }

        const pages = getDocxPageNodes(container);
        const pageCount = Math.max(pages.length, 1);
        onPageCountChange(pageCount);
        syncActivePage(0);
        onLoadingChange(false);
      } catch (error) {
        if (abortController.signal.aborted || isCancelled) {
          return;
        }

        console.error(error);
        container.innerHTML = "";
        onPageCountChange(0);
        onLoadingChange(false);
        onErrorChange(error instanceof Error ? error.message : "Unable to render Word pages.");
      }
    };

    void renderDocument();

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [documentKey, downloadUrl, onErrorChange, onLoadingChange, onPageCountChange, sourceFile, syncActivePage]);

  return (
    <div
      ref={containerRef}
      className="docx-page-reader scrollbar-hidden min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-[14px] bg-transparent px-1 py-1 md:px-2 md:py-2"
    />
  );
}

export function Dashboard() {
  const {
    caseId,
    llmConfig,
    systemStatus,
    entryState,
    isDefaultCase,
    snapshot,
    chatMessages,
    chatSending,
    apiError,
    apiFailure,
    sendChatMessage,
    uploadFiles,
    removeFolder,
    deleteCase,
    updateLlmConfig,
    openDefaultCase,
  } =
    useWorkbench();
  const documents = useMemo(() => snapshot?.documents ?? [], [snapshot]);
  const workspaceName = snapshot?.workspace.caseName ?? "Workspace";
  const sampleCapTableCount = snapshot?.captableVersions.length ?? 0;
  const latestCapTableVersion = useMemo(
    () => snapshot?.captableVersions.find((version) => version.status === "current") ?? snapshot?.captableVersions[0] ?? null,
    [snapshot],
  );
  const sampleProjectionCount = latestCapTableVersion?.projections.length ?? 0;
  const isBackendUnavailable = entryState === "backend_unreachable";
  const isBackendConnected = !isBackendUnavailable;
  const isLlmConfigured = Boolean(llmConfig.apiKey.trim() || systemStatus?.llm.configured);
  const canUseSampleWorkspace = Boolean(systemStatus?.mode.demoDataAvailable);
  const backendStatusLabel = entryState === "loading" ? "Checking" : isBackendConnected ? "Connected" : "Unavailable";
  const modeStatusLabel = !systemStatus
    ? "Checking"
    : isDefaultCase && canUseSampleWorkspace
      ? "Sample workspace"
      : canUseSampleWorkspace
        ? "Sample available"
        : "Empty workspace";
  const llmStatusLabel = !systemStatus ? "Checking" : isLlmConfigured ? "Configured" : "Not configured";

  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [surfaceMode, setSurfaceMode] = useState<WorkspaceSurfaceMode>("document");
  const [selectedProjection, setSelectedProjection] = useState("");
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedPreviewDocument[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>(EMPTY_UPLOAD_STATE);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [folderPendingRemoval, setFolderPendingRemoval] = useState<DocumentFolderGroup | null>(null);
  const [isRemovingFolder, setIsRemovingFolder] = useState(false);
  const [folderRemovalError, setFolderRemovalError] = useState<string | null>(null);
  const [isCaseDeleteDialogOpen, setIsCaseDeleteDialogOpen] = useState(false);
  const [caseDeleteConfirmText, setCaseDeleteConfirmText] = useState("");
  const [caseDeleteError, setCaseDeleteError] = useState<string | null>(null);
  const [isDeletingCase, setIsDeletingCase] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(llmConfig.apiKey);
  const [modelNameInput, setModelNameInput] = useState(llmConfig.modelName);
  const [chatInput, setChatInput] = useState("");
  const [wordPageCount, setWordPageCount] = useState(0);
  const [isWordRendererLoading, setIsWordRendererLoading] = useState(false);
  const [wordRendererError, setWordRendererError] = useState<string | null>(null);
  const canUploadDocuments = !isBackendUnavailable && uploadState.status !== "uploading";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const serverDocumentKeys = useMemo(
    () => new Set(documents.map((document) => getDocumentIdentity(document.fileName, document.relativePath))),
    [documents],
  );

  const documentItems = useMemo<DocumentListItem[]>(
    () => [
      ...uploadedDocuments
        .filter((document) => !serverDocumentKeys.has(getDocumentIdentity(document.fileName, document.relativePath)))
        .map((document) => ({
          id: document.id,
          fileName: document.fileName,
          uploadedAt: document.uploadedAt,
          evidenceStatus: "uploaded" as const,
          summary: document.summary,
          isUpload: true,
          relativePath: document.relativePath,
          folderPath: document.folderPath,
          identityKey: getDocumentIdentity(document.fileName, document.relativePath),
        })),
      ...documents.map((document) => ({
        id: document.id,
        fileName: document.fileName,
        uploadedAt: document.transactionDate ?? document.uploadedAt.slice(0, 10),
        evidenceStatus: document.evidenceStatus,
        summary: document.summary,
        isUpload: false,
        relativePath: document.relativePath ?? null,
        folderPath: document.folderPath ?? resolveFolderPath(document.relativePath),
        identityKey: getDocumentIdentity(document.fileName, document.relativePath),
      })),
    ],
    [documents, serverDocumentKeys, uploadedDocuments],
  );

  const folderGroups = useMemo<DocumentFolderGroup[]>(() => {
    const grouped = new Map<string, DocumentListItem[]>();
    documentItems.forEach((document) => {
      const folderPath = document.folderPath || ROOT_FOLDER_NAME;
      const bucket = grouped.get(folderPath);
      if (bucket) {
        bucket.push(document);
      } else {
        grouped.set(folderPath, [document]);
      }
    });

    return Array.from(grouped.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([folderPath, groupedDocuments]) => ({
        folderPath,
        documents: groupedDocuments.sort((left, right) => left.fileName.localeCompare(right.fileName)),
      }));
  }, [documentItems]);

  const recommendedSampleDocument = useMemo(
    () => documentItems.find((item) => !item.isUpload) ?? documentItems[0] ?? null,
    [documentItems],
  );
  const activeCapTableVersion = latestCapTableVersion;
  const capTableProjections = activeCapTableVersion?.projections ?? [];
  const effectiveProjection = selectedProjection || capTableProjections[0] || "";
  const visibleCapTableRows = useMemo(
    () => activeCapTableVersion?.rows.filter((row) => row.viewType === effectiveProjection) ?? [],
    [activeCapTableVersion, effectiveProjection],
  );
  const isCapTableMode = surfaceMode === "captable" && Boolean(activeCapTableVersion);

  useEffect(() => {
    if (selectedDocumentId && !documentItems.some((item) => item.id === selectedDocumentId)) {
      setSelectedDocumentId("");
    }
  }, [documentItems, selectedDocumentId]);

  useEffect(() => {
    if (!capTableProjections.length) {
      setSelectedProjection("");
      if (surfaceMode === "captable") {
        setSurfaceMode("document");
      }
      return;
    }
    if (!selectedProjection || !capTableProjections.includes(selectedProjection)) {
      setSelectedProjection(capTableProjections[0]);
    }
  }, [capTableProjections, selectedProjection, surfaceMode]);

  useEffect(() => {
    if (!folderGroups.length) {
      setExpandedFolders({});
      return;
    }
    setExpandedFolders((current) => {
      const next = { ...current };
      folderGroups.forEach((group) => {
        if (!(group.folderPath in next)) {
          next[group.folderPath] = true;
        }
      });
      Object.keys(next).forEach((folderPath) => {
        if (!folderGroups.some((group) => group.folderPath === folderPath)) {
          delete next[folderPath];
        }
      });
      return next;
    });
  }, [folderGroups]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatSending]);

  useEffect(() => {
    setActivePageIndex(0);
    setWordPageCount(0);
    setWordRendererError(null);
  }, [selectedDocumentId]);

  const buildUploadedPreview = useCallback(
    async (file: RelativePathFile): Promise<UploadedPreviewDocument> => {
      const lowerName = file.name.toLowerCase();
      const id = `upload-${crypto.randomUUID()}`;
      const uploadedAt = new Date().toISOString().slice(0, 10);
      const relativePath = normalizeRelativePath(file.webkitRelativePath);
      const folderPath = resolveFolderPath(relativePath);

      if (/\.docx$/i.test(lowerName)) {
        return {
          id,
          fileName: file.name,
          kind: "docx",
          file,
          uploadedAt,
          summary: "DOCX document ready for Word preview.",
          relativePath,
          folderPath,
        };
      }

      return {
        id,
        fileName: file.name,
        kind: "unsupported",
        uploadedAt,
        summary: "Preview is not supported for this file type yet.",
        relativePath,
        folderPath,
      };
    },
    [],
  );

  const handleFiles = useCallback(
    async (input: FileList | File[]) => {
      if (isBackendUnavailable) {
        setUploadState({
          status: "failed",
          message: "Backend is unavailable. Start the local services with `npm run dev`, then try uploading again.",
          details: [],
        });
        return;
      }

      const files = Array.from(input) as RelativePathFile[];

      if (files.length === 0) {
        return;
      }

      const docxFiles = files.filter((file) => file.name.toLowerCase().endsWith(".docx"));
      const ignoredCount = files.length - docxFiles.length;

      if (docxFiles.length === 0) {
        setUploadState({
          status: "failed",
          message: "Only DOCX files can be uploaded in this beta. Choose one or more `.docx` files and try again.",
          details: [],
        });
        setIsDraggingFiles(false);
        return;
      }

      setUploadState({
        status: "uploading",
        message: ignoredCount > 0 ? "Uploading DOCX files only..." : "Uploading documents...",
        details: [],
      });

      try {
        const nextDocuments = await Promise.all(docxFiles.map((file) => buildUploadedPreview(file)));
        const nextDocumentIds = new Set(nextDocuments.map((document) => document.id));

      setUploadedDocuments((current) => [...nextDocuments, ...current]);
      setSelectedDocumentId((current) => current || nextDocuments[0]?.id || "");
      setSurfaceMode("document");
      setIsDraggingFiles(false);

        const result = await uploadFiles(
          docxFiles,
          docxFiles.map((file) => normalizeRelativePath(file.webkitRelativePath)),
        );

        setUploadedDocuments((current) => current.filter((document) => !nextDocumentIds.has(document.id)));
      if (result.processed.length > 0) {
        setSelectedDocumentId(result.topology_updates[0]?.document_id ?? "");
        setSurfaceMode("document");
      } else {
        setSelectedDocumentId("");
      }

        if (result.failures.length > 0 && result.processed.length > 0) {
          setUploadState({
            status: "partial_success",
            message: `Uploaded ${result.processed.length} file(s). ${result.failures.length} failed.`,
            details: result.failures.map((failure) => `${failure.source_file}: ${failure.error}`),
          });
        } else if (result.failures.length > 0) {
          setUploadState({
            status: "failed",
            message: "Upload failed for this folder.",
            details: result.failures.map((failure) => `${failure.source_file}: ${failure.error}`),
          });
        } else {
          setUploadState({
            status: "success",
            message: `Successfully uploaded ${result.processed.length} file(s).`,
            details: [],
          });
        }
      } catch (error) {
        setUploadedDocuments((current) =>
          current.filter((document) => !docxFiles.some((file) => document.fileName === file.name)),
        );
        setSelectedDocumentId("");
        setUploadState({
          status: "failed",
          message:
            apiFailure?.category === "network_unreachable"
              ? "The upload could not reach the backend. Start the services with `npm run dev`, then try again."
              : error instanceof Error
                ? error.message
                : "The upload failed. Review the error details and try again.",
          details: apiFailure?.detail ? [apiFailure.detail] : [],
        });
        console.error(error);
      }
    },
    [apiFailure?.category, apiFailure?.detail, buildUploadedPreview, isBackendUnavailable, uploadFiles],
  );

  const handleSendMessage = useCallback(async () => {
    const message = chatInput.trim();
    if (!message || chatSending) {
      return;
    }

    try {
      await sendChatMessage(message);
      setChatInput("");
    } catch (error) {
      console.error(error);
    }
  }, [chatInput, chatSending, sendChatMessage]);

  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders((current) => ({
      ...current,
      [folderPath]: !current[folderPath],
    }));
  }, []);

  const handleConfirmRemoveFolder = useCallback(async () => {
    if (!folderPendingRemoval) {
      return;
    }

    setIsRemovingFolder(true);
    setFolderRemovalError(null);

    try {
      const removedIds = new Set(folderPendingRemoval.documents.map((document) => document.id));
      await removeFolder(folderPendingRemoval.folderPath);
      setUploadedDocuments((current) => current.filter((document) => !removedIds.has(document.id)));

      if (removedIds.has(selectedDocumentId)) {
        setSelectedDocumentId("");
      }

      setFolderPendingRemoval(null);
    } catch (error) {
      setFolderRemovalError(error instanceof Error ? error.message : "Failed to remove folder.");
    } finally {
      setIsRemovingFolder(false);
    }
  }, [folderPendingRemoval, removeFolder, selectedDocumentId]);

  const handleConfirmDeleteCase = useCallback(async () => {
    setIsDeletingCase(true);
    setCaseDeleteError(null);

    try {
      await deleteCase(caseDeleteConfirmText);
      setUploadedDocuments([]);
      setSelectedDocumentId("");
      setFolderPendingRemoval(null);
      setCaseDeleteConfirmText("");
      setIsCaseDeleteDialogOpen(false);
      setUploadState(EMPTY_UPLOAD_STATE);
    } catch (error) {
      setCaseDeleteError(error instanceof Error ? error.message : "Failed to permanently delete workspace.");
    } finally {
      setIsDeletingCase(false);
    }
  }, [caseDeleteConfirmText, deleteCase]);

  const handleSaveLlmSettings = useCallback(() => {
    updateLlmConfig({
      apiKey: apiKeyInput,
      modelName: modelNameInput,
    });
  }, [apiKeyInput, modelNameInput, updateLlmConfig]);

  const activeDocumentItem = documentItems.find((document) => document.id === selectedDocumentId) ?? null;
  const activeUploadedDocument = uploadedDocuments.find((document) => document.id === selectedDocumentId) ?? null;
  const activeServerDocument = documents.find((document) => document.id === selectedDocumentId) ?? null;

  const activeDocumentIsDocx = useMemo(() => {
    const fileName = activeUploadedDocument?.fileName ?? activeServerDocument?.fileName ?? activeDocumentItem?.fileName ?? "";
    return fileName.toLowerCase().endsWith(".docx");
  }, [activeDocumentItem?.fileName, activeServerDocument?.fileName, activeUploadedDocument?.fileName]);

  const activeDocumentDownloadUrl = useMemo(() => {
    if (!activeServerDocument?.id) {
      return null;
    }
    return topologyApi.getDocumentDownloadUrl(caseId, activeServerDocument.id);
  }, [activeServerDocument?.id, caseId]);

  const totalPages = activeDocumentIsDocx ? wordPageCount : 0;

  useEffect(() => {
    if (totalPages === 0 && activePageIndex !== 0) {
      setActivePageIndex(0);
      return;
    }

    if (activePageIndex >= totalPages && totalPages > 0) {
      setActivePageIndex(totalPages - 1);
    }
  }, [activePageIndex, totalPages]);

  useEffect(() => {
    setApiKeyInput(llmConfig.apiKey);
    setModelNameInput(llmConfig.modelName);
  }, [llmConfig]);

  const canGoToPreviousPage = activePageIndex > 0;
  const canGoToNextPage = activePageIndex < totalPages - 1;
  const isReaderError =
    !isCapTableMode &&
    !!selectedDocumentId &&
    (activeServerDocument?.processingStatus === "error" ||
      (!!wordRendererError && uploadState.status !== "uploading"));

  const goToPreviousPage = useCallback(() => {
    if (!canGoToPreviousPage) {
      return;
    }
    setActivePageIndex((current) => current - 1);
  }, [canGoToPreviousPage]);

  const goToNextPage = useCallback(() => {
    if (!canGoToNextPage) {
      return;
    }
    setActivePageIndex((current) => current + 1);
  }, [canGoToNextPage]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="h-full w-full"
    >
      <div className="flex h-full w-full overflow-hidden bg-[#0A0A0A]">
        <motion.aside
          animate={{ width: isLeftPanelCollapsed ? COLLAPSED_RAIL_WIDTH : LEFT_PANEL_WIDTH }}
          transition={PANEL_TRANSITION}
          className="h-full shrink-0 overflow-hidden border-r border-white/10 bg-white/[0.04]"
        >
          {isLeftPanelCollapsed ? (
            <button
              onClick={() => setIsLeftPanelCollapsed(false)}
              className="group flex h-full w-full flex-col items-center justify-center gap-4 bg-transparent px-2 text-white/68 transition hover:bg-white/[0.03]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-orange-200 transition group-hover:border-orange-300/30 group-hover:bg-orange-500/10">
                <PanelLeftOpen className="h-4 w-4" />
              </span>
              <span className="[writing-mode:vertical-rl] text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50 [text-orientation:mixed]">
                AI Chat
              </span>
            </button>
          ) : (
            <div className="flex h-full min-w-0 flex-col">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-orange-500/12 p-3 text-orange-100">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/38">Assistant</div>
                    <div className="mt-1 text-sm font-semibold text-white">AI Chat</div>
                  </div>
                </div>
                <button
                  onClick={() => setIsLeftPanelCollapsed(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/65 transition hover:border-orange-300/24 hover:bg-orange-500/10 hover:text-orange-100 active:scale-[0.97]"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>

              <div ref={chatScrollRef} className="scrollbar-hidden flex-1 min-h-0 space-y-4 overflow-y-auto px-4 py-4">
                {chatMessages.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-sm leading-6 text-white/48">
                    暂无对话。选中文档后，你可以在这里询问条款、证据冲突或关键信息。
                  </div>
                ) : null}

                {chatMessages.map((message) => {
                  const isUser = message.role === "user";
                  const timestamp = new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[92%] rounded-[18px] px-4 py-3 text-sm leading-6",
                          isUser
                            ? "rounded-tr-sm border border-orange-500/20 bg-orange-500/10 text-orange-50"
                            : "rounded-tl-sm border border-white/10 bg-white/[0.03] text-white/80",
                        )}
                      >
                        {message.content}
                      </div>
                      <div className={cn("text-[10px] text-white/28", isUser ? "mr-1" : "ml-1")}>{timestamp}</div>
                    </motion.div>
                  );
                })}

                {chatSending ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-start gap-1"
                  >
                    <div className="rounded-[18px] rounded-tl-sm border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
                      Thinking...
                    </div>
                  </motion.div>
                ) : null}
              </div>

              <div className="border-t border-white/10 p-3">
                <div className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
                  <input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    className="flex-1 bg-transparent text-sm text-white/82 outline-none placeholder:text-white/34"
                    disabled={!snapshot || isBackendUnavailable}
                    placeholder={
                      isBackendUnavailable
                        ? "Backend unavailable. Start `npm run dev` to enable chat..."
                        : !snapshot
                          ? "Open the sample workspace or upload documents to begin..."
                        : !llmConfig.apiKey.trim()
                          ? "Chat requires an API key in Workspace Settings..."
                        : selectedDocumentId
                          ? "Ask about the active document..."
                          : "Select a document, then ask a question..."
                    }
                  />
                  <button
                    onClick={() => void handleSendMessage()}
                    disabled={!snapshot || isBackendUnavailable || !llmConfig.apiKey.trim() || !chatInput.trim() || chatSending}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full transition",
                      !chatInput.trim() || chatSending
                        ? "bg-orange-500/8 text-orange-100/35"
                        : "bg-orange-500/14 text-orange-100 hover:bg-orange-500/20 active:scale-[0.97]",
                    )}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                {apiError ? (
                  <div className="mt-2 rounded-[14px] border border-rose-400/15 bg-rose-500/10 px-3 py-2 text-xs leading-5 text-rose-200">
                    <div>{apiError}</div>
                    {apiFailure?.detail ? <div className="mt-1 text-[11px] text-rose-100/75">{apiFailure.detail}</div> : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </motion.aside>

        <section
          className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0.008))]"
          onDragOver={(event) => {
            if (isBackendUnavailable) {
              return;
            }
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
            if (isBackendUnavailable) {
              return;
            }
            event.preventDefault();
            setIsDraggingFiles(false);
            void handleFiles(event.dataTransfer.files);
          }}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.24em] text-orange-200/70">
                {isCapTableMode ? "Cap Table Review" : "Document Reader"}
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-white">
                {isCapTableMode ? activeCapTableVersion?.versionName ?? "Working cap table" : activeDocumentItem?.fileName ?? "No document selected"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeCapTableVersion ? (
                <div className="mr-2 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] p-1">
                  <button
                    onClick={() => setSurfaceMode("document")}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] transition",
                      !isCapTableMode ? "bg-orange-500/14 text-orange-100" : "text-white/55 hover:bg-white/[0.04]",
                    )}
                  >
                    Document
                  </button>
                  <button
                    onClick={() => setSurfaceMode("captable")}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] transition",
                      isCapTableMode ? "bg-orange-500/14 text-orange-100" : "text-white/55 hover:bg-white/[0.04]",
                    )}
                  >
                    Cap Table
                  </button>
                </div>
              ) : null}
              <button
                onClick={goToPreviousPage}
                disabled={isCapTableMode || !canGoToPreviousPage}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border transition",
                  !isCapTableMode && canGoToPreviousPage
                    ? "border-white/10 bg-white/[0.04] text-white hover:border-orange-300/24 hover:bg-orange-500/10 active:scale-[0.97]"
                    : "border-white/6 bg-white/[0.02] text-white/25",
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-[76px] text-center text-xs font-medium text-white/52">
                {isCapTableMode
                  ? `${visibleCapTableRows.length} row${visibleCapTableRows.length === 1 ? "" : "s"}`
                  : selectedDocumentId
                    ? `${Math.min(activePageIndex + 1, Math.max(totalPages, 1))} / ${Math.max(totalPages, 1)}`
                    : "0 / 0"}
              </div>
              <button
                onClick={goToNextPage}
                disabled={isCapTableMode || !canGoToNextPage}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border transition",
                  !isCapTableMode && canGoToNextPage
                    ? "border-white/10 bg-white/[0.04] text-white hover:border-orange-300/24 hover:bg-orange-500/10 active:scale-[0.97]"
                    : "border-white/6 bg-white/[0.02] text-white/25",
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="relative flex-1 min-h-0 overflow-hidden px-3 py-3">
            {isCapTableMode ? (
              <ReaderSurface contentClassName="overflow-hidden">
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 pb-4">
                    <div className="max-w-[560px]">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-orange-200/70">Working version</div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {activeCapTableVersion?.versionName ?? "Working cap table"}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-white/58">
                        {activeCapTableVersion?.summary ??
                          "Rows are grouped by projection so you can distinguish issued/outstanding ownership, reserved pool, and fully diluted views."}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {capTableProjections.map((projection) => (
                        <button
                          key={projection}
                          onClick={() => setSelectedProjection(projection)}
                          className={cn(
                            "rounded-full border px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] transition",
                            effectiveProjection === projection
                              ? "border-orange-300/20 bg-orange-500/14 text-orange-100"
                              : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]",
                          )}
                        >
                          {formatProjectionLabel(projection)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">Projection</div>
                      <div className="mt-2 text-sm font-semibold text-white">
                        {effectiveProjection ? formatProjectionLabel(effectiveProjection) : "Unavailable"}
                      </div>
                    </div>
                    <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">Rows</div>
                      <div className="mt-2 text-sm font-semibold text-white">{visibleCapTableRows.length}</div>
                    </div>
                    <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">Evidence Links</div>
                      <div className="mt-2 text-sm font-semibold text-white">
                        {visibleCapTableRows.reduce((sum, row) => sum + row.evidenceIds.length, 0)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                    {visibleCapTableRows.length === 0 ? (
                      <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm leading-6 text-white/52">
                        No rows are available for this projection yet. This usually means the extracted events did not meet the rule
                        boundary for this view.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {visibleCapTableRows.map((row) => (
                          <div key={`${row.viewType}-${row.holderName}-${row.securityType}-${row.sourceLocation}`} className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">{row.securityType}</div>
                                <div className="mt-2 text-base font-semibold text-white">{row.holderName}</div>
                                <div className="mt-2 text-sm leading-6 text-white/58">
                                  {row.shareClass ? `${row.shareClass}` : "Security class unavailable"}
                                  {row.series ? ` · ${row.series}` : ""}
                                  {` · ${row.shares.toLocaleString()} shares`}
                                  {` · ${row.ownershipPercentage}% of ${formatProjectionLabel(row.viewType)}`}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={cn("text-sm font-semibold", getConfidenceTone(row.confidence))}>
                                  {Math.round(row.confidence * 100)}% confidence
                                </div>
                                <div className="mt-2 text-xs text-white/45">{row.sourceLocation}</div>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/60">
                                {formatProjectionLabel(row.viewType)}
                              </span>
                              <span className="rounded-full border border-sky-400/20 bg-sky-500/12 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-sky-100">
                                {row.eventStatus}
                              </span>
                              <span className={cn("rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em]", getReviewStatusTone(row.reviewStatus))}>
                                {formatReviewStatusLabel(row.reviewStatus)}
                              </span>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr,0.8fr]">
                              <div className="rounded-[16px] border border-white/8 bg-black/20 px-3 py-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">Why this row exists</div>
                                <div className="mt-2 text-sm leading-6 text-white/68">{row.statusMeaning}</div>
                              </div>
                              <div className="rounded-[16px] border border-white/8 bg-black/20 px-3 py-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">Traceability</div>
                                <div className="mt-2 text-sm leading-6 text-white/68">
                                  {row.eventIds.length} event link{row.eventIds.length === 1 ? "" : "s"} · {row.evidenceIds.length} evidence link
                                  {row.evidenceIds.length === 1 ? "" : "s"}
                                </div>
                                {row.evidenceIds.length ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {row.evidenceIds.map((evidenceId) => (
                                      <span
                                        key={evidenceId}
                                        className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/52"
                                      >
                                        {evidenceId}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ReaderSurface>
            ) : !selectedDocumentId ? (
              <ReaderSurface>
                <div className="flex flex-1 items-center justify-center">
                  <div className="max-w-[440px] text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-orange-300/18 bg-orange-500/10 text-orange-200">
                      <FileText className="h-7 w-7" />
                    </div>
                    <h2 className="mt-6 text-2xl font-semibold text-white">
                      {entryState === "loading"
                        ? "正在检查工作区状态"
                        : entryState === "backend_unreachable"
                        ? "后端未连接"
                        : entryState === "demo_available"
                          ? "打开示例工作区"
                          : isDefaultCase && documentItems.length > 0
                            ? "开始浏览示例工作区"
                          : snapshot
                            ? "开始新的工作区"
                            : "Workspace 已永久删除"}
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-white/58">
                      {entryState === "loading"
                        ? "正在确认后端连接、示例数据和当前工作区状态。请稍等片刻。"
                        : entryState === "backend_unreachable"
                        ? "当前无法连接到本地后端。请先运行 `npm run dev`，然后刷新页面。Workspace Settings 仍然可用。"
                        : entryState === "demo_available"
                          ? "当前有现成的示例数据可直接查看。你也可以跳过示例，直接上传新的 DOCX 文档开始审阅。"
                          : isDefaultCase && documentItems.length > 0
                            ? "你正在查看内置示例数据。建议先打开一份示例文件，确认文档阅读区、文件列表和当前工作区状态，再决定是否上传你自己的 DOCX。"
                          : snapshot
                            ? "从右侧 `Files` 选择一份文档，或先上传新的 DOCX 文档。进入后使用左右按钮切换分页。"
                            : "当前 case 的上传文件、结构化结果、工作台派生数据和聊天上下文已经被永久清理。你可以上传新的 DOCX 重新开始。"}
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em]",
                          isBackendConnected
                            ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-100"
                            : "border-rose-400/20 bg-rose-500/12 text-rose-100",
                        )}
                      >
                        Backend {backendStatusLabel}
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em]",
                          canUseSampleWorkspace
                            ? "border-sky-400/20 bg-sky-500/12 text-sky-100"
                            : "border-white/10 bg-white/[0.04] text-white/60",
                        )}
                      >
                        {modeStatusLabel}
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em]",
                          isLlmConfigured
                            ? "border-amber-300/20 bg-amber-500/12 text-amber-100"
                            : "border-white/10 bg-white/[0.04] text-white/60",
                        )}
                      >
                        LLM {llmStatusLabel}
                      </span>
                    </div>
                    {!isLlmConfigured ? (
                      <div className="mt-4 rounded-[16px] border border-amber-300/15 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                        AI explanation is limited until you add an API key in Workspace Settings.
                      </div>
                    ) : null}
                    {isDefaultCase && documentItems.length > 0 ? (
                      <div className="mt-4 rounded-[18px] border border-sky-400/14 bg-sky-500/[0.08] px-4 py-4 text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.18em] text-sky-100/70">Guided Sample</div>
                            <div className="mt-2 text-sm font-semibold text-white">Suggested first step</div>
                            <div className="mt-2 text-sm leading-6 text-white/65">
                              Open {recommendedSampleDocument?.fileName ?? "the first sample file"} first, then use the Files
                              panel to compare how the sample workspace is organized.
                            </div>
                          </div>
                          <div className="rounded-[14px] border border-white/10 bg-black/20 px-3 py-2 text-right">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-white/38">Sample Data</div>
                            <div className="mt-2 text-sm font-semibold text-white">{documentItems.length} docs</div>
                            <div className="mt-1 text-xs text-white/50">{sampleCapTableCount} cap table views</div>
                            <div className="mt-1 text-xs text-white/50">
                              {latestCapTableVersion?.rows.length ?? 0} rows across {sampleProjectionCount} projections
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            onClick={() => {
                              if (recommendedSampleDocument) {
                                setSelectedDocumentId(recommendedSampleDocument.id);
                                setSurfaceMode("document");
                              }
                            }}
                            className="rounded-full bg-sky-500/14 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-500/20 active:scale-[0.98]"
                          >
                            Open Recommended File
                          </button>
                          <button
                            onClick={() => setIsRightPanelCollapsed(false)}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.08] active:scale-[0.98]"
                          >
                            Review Files Panel
                          </button>
                        </div>
                        {latestCapTableVersion?.projections.length ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {latestCapTableVersion.projections.map((projection) => (
                              <span
                                key={projection}
                                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/60"
                              >
                                {projection.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {latestCapTableVersion ? (
                          <div className="mt-4">
                            <button
                              onClick={() => setSurfaceMode("captable")}
                              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/78 transition hover:bg-white/[0.08] active:scale-[0.98]"
                            >
                              Open Working Cap Table
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                      {entryState === "demo_available" ? (
                        <button
                          onClick={() => void openDefaultCase()}
                          disabled={!canUseSampleWorkspace || isBackendUnavailable}
                          className={cn(
                            "rounded-full px-5 py-3 text-sm font-medium transition",
                            canUseSampleWorkspace && !isBackendUnavailable
                              ? "bg-orange-500/14 text-orange-100 hover:bg-orange-500/20 active:scale-[0.98]"
                              : "cursor-not-allowed bg-orange-500/8 text-orange-100/35",
                          )}
                        >
                          Open Sample Workspace
                        </button>
                      ) : null}
                      <button
                        onClick={() => {
                          setIsRightPanelCollapsed(false);
                        }}
                        disabled={entryState === "loading"}
                        className={cn(
                          "rounded-full px-5 py-3 text-sm font-medium transition",
                          entryState === "loading"
                            ? "cursor-not-allowed bg-orange-500/8 text-orange-100/35"
                            : "bg-orange-500/14 text-orange-100 hover:bg-orange-500/20 active:scale-[0.98]",
                        )}
                      >
                        {entryState === "backend_unreachable" ? "查看文件面板" : "选择文件"}
                      </button>
                      <button
                        onClick={() => folderInputRef.current?.click()}
                        disabled={!canUploadDocuments}
                        className={cn(
                          "rounded-full border px-5 py-3 text-sm font-medium transition",
                          canUploadDocuments
                            ? "border-white/10 bg-white/[0.04] text-white/78 hover:bg-white/[0.08] active:scale-[0.98]"
                            : "cursor-not-allowed border-white/6 bg-white/[0.02] text-white/28",
                        )}
                      >
                        上传文档
                      </button>
                    </div>
                    {apiError && entryState !== "backend_unreachable" ? (
                      <div className="mt-4 text-xs leading-6 text-white/42">{apiError}</div>
                    ) : null}
                  </div>
                </div>
              </ReaderSurface>
            ) : activeDocumentIsDocx ? (
              <ReaderSurface contentClassName="overflow-hidden">
                <div className="relative flex h-full min-h-0 flex-col">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/28">
                      Page {Math.min(activePageIndex + 1, Math.max(totalPages, 1))}
                    </div>
                    <div className="rounded-full border border-white/8 bg-white/[0.02] px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] text-white/38">
                      {activeDocumentItem?.evidenceStatus ?? "ready"}
                    </div>
                  </div>

                  <motion.div
                    animate={{ x: 0 }}
                    transition={PAGE_TRANSITION}
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <DocxPageReader
                      documentKey={selectedDocumentId}
                      pageIndex={activePageIndex}
                      sourceFile={activeUploadedDocument?.file}
                      downloadUrl={activeUploadedDocument?.file ? null : activeDocumentDownloadUrl}
                      onPageCountChange={setWordPageCount}
                      onLoadingChange={setIsWordRendererLoading}
                      onErrorChange={setWordRendererError}
                    />
                  </motion.div>

                  <AnimatePresence>
                    {isWordRendererLoading ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-10 flex items-center justify-center rounded-[22px] bg-black/58 backdrop-blur-sm"
                      >
                        <div className="text-center">
                          <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-orange-200" />
                          <div className="mt-4 text-base font-medium text-white">Preparing Word pages...</div>
                          <div className="mt-2 text-sm text-white/50">
                            The reader shell stays fixed while the DOCX layout is rendered.
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <AnimatePresence>
                    {isReaderError ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 flex items-center justify-center rounded-[22px] bg-black/78 px-6 backdrop-blur-sm"
                      >
                        <div className="max-w-[420px] text-center">
                          <div className="text-lg font-semibold text-white">Unable to render this document</div>
                          <div className="mt-3 text-sm leading-7 text-white/56">
                            {wordRendererError ??
                              "The document is currently unavailable. Select another file from `Files` or re-upload the source document."}
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </ReaderSurface>
            ) : (
              <ReaderSurface>
                <div className="flex flex-1 items-center justify-center">
                  <div className="max-w-[420px] text-center">
                    <div className="text-lg font-semibold text-white">Word rendering is only available for DOCX</div>
                    <div className="mt-3 text-sm leading-7 text-white/56">
                      Select a DOCX document to open the strict Word-style reader. Other file types are not part of this rendering path.
                    </div>
                  </div>
                </div>
              </ReaderSurface>
            )}

            {isDraggingFiles ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/72 backdrop-blur-sm">
                <div className="rounded-[28px] border border-orange-300/24 bg-orange-500/10 px-10 py-8 text-center shadow-2xl">
                  <Upload className="mx-auto h-8 w-8 text-orange-200" />
                  <div className="mt-4 text-lg font-semibold text-white">Drop DOCX files to upload</div>
                  <div className="mt-2 text-sm text-white/55">They will appear in the Files panel and open in the reader.</div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <motion.aside
          animate={{ width: isRightPanelCollapsed ? COLLAPSED_RAIL_WIDTH : RIGHT_PANEL_WIDTH }}
          transition={PANEL_TRANSITION}
          className="h-full shrink-0 overflow-hidden border-l border-white/10 bg-white/[0.04]"
        >
          {isRightPanelCollapsed ? (
            <button
              onClick={() => setIsRightPanelCollapsed(false)}
              className="group flex h-full w-full flex-col items-center justify-center gap-4 bg-transparent px-2 text-white/68 transition hover:bg-white/[0.03]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-orange-200 transition group-hover:border-orange-300/30 group-hover:bg-orange-500/10">
                <PanelRightOpen className="h-4 w-4" />
              </span>
              <span className="[writing-mode:vertical-rl] text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50 [text-orientation:mixed]">
                Files
              </span>
            </button>
          ) : (
            <div className="flex h-full min-w-0 flex-col">
              <div className="border-b border-white/10 px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setIsRightPanelCollapsed(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/65 transition hover:border-orange-300/24 hover:bg-orange-500/10 hover:text-orange-100 active:scale-[0.97]"
                  >
                    <PanelRightClose className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsSettingsDialogOpen(true)}
                      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/70 transition hover:bg-white/[0.08] active:scale-[0.98]"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Settings
                    </button>
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-white/38">
                        {isDefaultCase ? "Sample Workspace" : "Workspace"}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">{isDefaultCase ? "Sample Files" : "Files"}</div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/45">
                      {documentItems.length}
                    </div>
                  </div>
                </div>

                {isDefaultCase ? (
                  <div className="mt-3 rounded-[16px] border border-sky-400/15 bg-sky-500/10 px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-sky-100/70">Sample Workspace</div>
                    <div className="mt-2 text-sm font-semibold text-white">You are viewing built-in demonstration data.</div>
                    <div className="mt-2 text-xs leading-5 text-white/62">
                      Use this workspace to understand the file layout, document reader, and evidence-backed workflow before uploading your own matter.
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">Backend</div>
                    <div
                      className={cn(
                        "mt-2 text-xs font-semibold",
                        isBackendConnected ? "text-emerald-100" : "text-rose-200",
                      )}
                    >
                      {backendStatusLabel}
                    </div>
                  </div>
                  <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">Mode</div>
                    <div className="mt-2 text-xs font-semibold text-sky-100">{modeStatusLabel}</div>
                  </div>
                  <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">LLM</div>
                    <div className={cn("mt-2 text-xs font-semibold", isLlmConfigured ? "text-amber-100" : "text-white/65")}>
                      {llmStatusLabel}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {activeCapTableVersion ? (
                    <button
                      onClick={() => setSurfaceMode("captable")}
                      className="col-span-2 rounded-[16px] border border-orange-300/18 bg-orange-500/10 px-3 py-3 text-left transition hover:bg-orange-500/14"
                    >
                      <div className="text-[10px] uppercase tracking-[0.18em] text-orange-100/70">Cap Table</div>
                      <div className="mt-2 text-sm font-semibold text-white">Open working cap table</div>
                      <div className="mt-1 text-xs leading-5 text-white/58">
                        Review projections, confidence, and evidence links without leaving this workspace.
                      </div>
                    </button>
                  ) : null}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".docx"
                    onChange={(event) => {
                      if (event.target.files) {
                        void handleFiles(event.target.files);
                      }
                      event.currentTarget.value = "";
                    }}
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".docx"
                    onChange={(event) => {
                      if (event.target.files) {
                        void handleFiles(event.target.files);
                      }
                      event.currentTarget.value = "";
                    }}
                    {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!canUploadDocuments}
                    className={cn(
                      "rounded-full border px-3 py-2 text-sm transition",
                      !canUploadDocuments
                        ? "cursor-not-allowed border-white/6 bg-white/[0.02] text-white/28"
                        : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] active:scale-[0.98]",
                    )}
                  >
                    Upload Files
                  </button>
                  <button
                    onClick={() => folderInputRef.current?.click()}
                    disabled={!canUploadDocuments}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm transition",
                      !canUploadDocuments
                        ? "cursor-not-allowed border-white/6 bg-white/[0.02] text-white/28"
                        : "border-orange-300/18 bg-orange-500/10 text-orange-100 hover:bg-orange-500/14 active:scale-[0.98]",
                    )}
                  >
                    <Upload
                      className={cn(
                        "h-4 w-4",
                        !canUploadDocuments ? "text-white/28" : "text-orange-200",
                      )}
                    />
                    {uploadState.status === "uploading" ? "Uploading..." : "Upload Folder"}
                  </button>
                </div>

                {isBackendUnavailable ? (
                  <div className="mt-3 rounded-[16px] border border-rose-400/15 bg-rose-500/10 px-3 py-2 text-xs leading-5 text-rose-100">
                    Backend unavailable. Start `npm run dev` to enable uploads, document loading, and sample data access.
                  </div>
                ) : null}

                {uploadState.message ? (
                  <div
                    className={cn(
                      "mt-3 rounded-[16px] border px-3 py-2 text-xs leading-5",
                      uploadState.status === "failed"
                        ? "border-rose-400/15 bg-rose-500/10 text-rose-100"
                        : uploadState.status === "partial_success"
                          ? "border-amber-300/15 bg-amber-500/10 text-amber-100"
                          : uploadState.status === "success"
                            ? "border-emerald-300/15 bg-emerald-500/10 text-emerald-100"
                            : "border-white/8 bg-white/[0.03] text-white/58",
                    )}
                  >
                    <div>{uploadState.message}</div>
                    {uploadState.details.slice(0, 2).map((detail) => (
                      <div key={detail} className="mt-1 text-[11px] text-current/80">
                        {detail}
                      </div>
                    ))}
                  </div>
                ) : null}

                {snapshot ? (
                  <div className="mt-3 rounded-[18px] border border-rose-400/14 bg-rose-500/[0.08] px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-rose-200/70">Danger Zone</div>
                      <div className="mt-2 text-sm font-semibold text-white">Delete Current Workspace</div>
                      <div className="mt-2 text-xs leading-5 text-white/58">
                        Permanently deletes uploaded files, structured results, cap table outputs, topology data, and chat
                        history for {workspaceName}.
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setCaseDeleteError(null);
                        setCaseDeleteConfirmText("");
                        setIsCaseDeleteDialogOpen(true);
                      }}
                      className="flex shrink-0 items-center gap-2 rounded-full border border-rose-400/18 bg-rose-500/12 px-3 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-500/18 active:scale-[0.98]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                  </div>
                ) : null}
              </div>

              <div className="scrollbar-hidden flex-1 min-h-0 space-y-2 overflow-y-auto px-3 py-3">
                {folderGroups.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm leading-6 text-white/46">
                    {isDefaultCase
                      ? "示例工作区当前没有可显示的文件。你可以切回私有工作区并上传 DOCX，或刷新后再次检查示例数据。"
                      : canUseSampleWorkspace
                        ? "当前没有文档。你可以上传 DOCX，或在首屏打开现有示例工作区。"
                        : "当前没有文档。上传 DOCX 文件后，它们会出现在这里。"}
                  </div>
                ) : null}

                {folderGroups.map((group) => {
                  const isExpanded = expandedFolders[group.folderPath] ?? true;

                  return (
                    <div
                      key={group.folderPath}
                      className="overflow-hidden rounded-[20px] border border-white/8 bg-black/18"
                    >
                      <div className="flex items-center gap-2 px-2 py-2">
                        <button
                          onClick={() => toggleFolder(group.folderPath)}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-[15px] px-2.5 py-2.5 text-left transition hover:bg-white/[0.05]"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/64 transition">
                            <ChevronRight
                              className={cn("h-4 w-4 transition-transform duration-200 ease-out", isExpanded ? "rotate-90" : "")}
                            />
                          </span>
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-200">
                            {isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">{group.folderPath}</div>
                            <div className="mt-1 text-[11px] text-white/40">
                              {group.documents.length} file{group.documents.length === 1 ? "" : "s"}
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            setFolderRemovalError(null);
                            setFolderPendingRemoval(group);
                          }}
                          className="flex shrink-0 items-center gap-2 rounded-full border border-rose-400/15 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/18 active:scale-[0.98]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>

                      <AnimatePresence initial={false}>
                        {isExpanded ? (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-1.5 border-t border-white/8 px-2 pb-2 pt-1.5">
                              {group.documents.map((document) => (
                                <button
                                  key={document.id}
                                  onClick={() => {
                                    setSelectedDocumentId(document.id);
                                    setSurfaceMode("document");
                                  }}
                                  className={cn(
                                    "flex w-full items-start justify-between gap-3 rounded-[15px] border px-3 py-2.5 text-left transition",
                                    selectedDocumentId === document.id
                                      ? "border-orange-300/28 bg-orange-500/12"
                                      : "border-transparent bg-white/[0.02] hover:bg-white/[0.05]",
                                  )}
                                >
                                  <div className="min-w-0 pr-3">
                                    <div className="truncate text-sm font-semibold text-white">{document.fileName}</div>
                                    <div className="mt-1 text-xs text-white/40">{document.uploadedAt}</div>
                                  </div>
                                  <span
                                    className={cn(
                                      "shrink-0 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]",
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
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.aside>
      </div>

      <AnimatePresence>
        {folderPendingRemoval ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/72 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={PAGE_TRANSITION}
              className="w-full max-w-md rounded-[26px] border border-white/10 bg-[#111111]/95 p-6 shadow-2xl"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-rose-400/15 bg-rose-500/10 text-rose-200">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-white">Permanently Delete Folder</div>
                  <div className="mt-2 text-sm leading-6 text-white/65">
                    This permanently deletes uploaded DOCX files in the selected folder, their structured results, cap table
                    outputs, and current case chat context.
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">Folder</div>
                <div className="mt-2 truncate text-sm font-medium text-white">{folderPendingRemoval.folderPath}</div>
                <div className="mt-1 text-xs text-white/45">
                  {folderPendingRemoval.documents.length} file{folderPendingRemoval.documents.length === 1 ? "" : "s"} will be permanently deleted
                </div>
              </div>

              {folderRemovalError ? (
                <div className="mt-4 rounded-[14px] border border-rose-400/15 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {folderRemovalError}
                </div>
              ) : null}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    if (!isRemovingFolder) {
                      setFolderPendingRemoval(null);
                      setFolderRemovalError(null);
                    }
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/72 transition hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleConfirmRemoveFolder()}
                  disabled={isRemovingFolder}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium text-white transition",
                    isRemovingFolder
                      ? "bg-rose-500/40 text-white/70"
                      : "bg-rose-500/85 hover:bg-rose-500 active:scale-[0.98]",
                  )}
                >
                  {isRemovingFolder ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {isCaseDeleteDialogOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/76 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={PAGE_TRANSITION}
              className="w-full max-w-md rounded-[26px] border border-white/10 bg-[#111111]/95 p-6 shadow-2xl"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-rose-400/15 bg-rose-500/10 text-rose-200">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-white">Permanently Delete Workspace</div>
                  <div className="mt-2 text-sm leading-6 text-white/65">
                    This permanently deletes all uploaded files, structured results, cap table outputs, topology data, and chat
                    history for this case.
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">Workspace</div>
                <div className="mt-2 truncate text-sm font-medium text-white">{workspaceName}</div>
                <div className="mt-3 text-xs text-white/45">Type `DELETE` to confirm permanent removal.</div>
                <input
                  value={caseDeleteConfirmText}
                  onChange={(event) => setCaseDeleteConfirmText(event.target.value)}
                  placeholder="DELETE"
                  className="mt-3 w-full rounded-[14px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
                />
              </div>

              {caseDeleteError ? (
                <div className="mt-4 rounded-[14px] border border-rose-400/15 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {caseDeleteError}
                </div>
              ) : null}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    if (!isDeletingCase) {
                      setIsCaseDeleteDialogOpen(false);
                      setCaseDeleteError(null);
                      setCaseDeleteConfirmText("");
                    }
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/72 transition hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleConfirmDeleteCase()}
                  disabled={isDeletingCase || caseDeleteConfirmText.trim().toUpperCase() !== "DELETE"}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium text-white transition",
                    isDeletingCase || caseDeleteConfirmText.trim().toUpperCase() !== "DELETE"
                      ? "bg-rose-500/40 text-white/70"
                      : "bg-rose-500/85 hover:bg-rose-500 active:scale-[0.98]",
                  )}
                >
                  {isDeletingCase ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {isSettingsDialogOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/76 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={PAGE_TRANSITION}
              className="w-full max-w-md rounded-[26px] border border-white/10 bg-[#111111]/95 p-6 shadow-2xl"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/80">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-white">Workspace Settings</div>
                  <div className="mt-2 text-sm leading-6 text-white/65">
                    Configure your DeepSeek API key and model for this browser session. The key is not shown on the main screen.
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/38">Case ID</div>
                  <div className="rounded-[14px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/78">
                    {caseId}
                  </div>
                  <div className="mt-2 text-xs text-white/45">
                    {isDefaultCase ? "Sample workspace is currently open." : "You are in a private session workspace."}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/38">Backend Status</div>
                  <div className="rounded-[14px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/78">
                    {backendStatusLabel}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/38">DeepSeek API Key</div>
                  <input
                    value={apiKeyInput}
                    onChange={(event) => setApiKeyInput(event.target.value)}
                    type="password"
                    placeholder="Enter your DeepSeek API key"
                    className="w-full rounded-[14px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
                  />
                </div>
                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/38">Model</div>
                  <input
                    value={modelNameInput}
                    onChange={(event) => setModelNameInput(event.target.value)}
                    placeholder="deepseek-chat"
                    className="w-full rounded-[14px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsSettingsDialogOpen(false)}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/72 transition hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleSaveLlmSettings();
                    setIsSettingsDialogOpen(false);
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-sm text-white transition hover:bg-white/[0.12] active:scale-[0.98]"
                >
                  Save Settings
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
