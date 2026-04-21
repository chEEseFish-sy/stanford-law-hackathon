import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { topologyApi } from "../lib/api/topologyApi";
import type {
  ApiFailure,
  ChatMessage,
  DeletionResponse,
  LlmSessionConfig,
  SystemStatus,
  TopologyNodeDetail,
  WorkbenchSnapshot,
  WorkspaceEntryState,
} from "../types/topology";

const CASE_ID_STORAGE_KEY = "vericap.case_id";
const LLM_CONFIG_STORAGE_KEY = "vericap.llm_config";
const DEFAULT_LLM_MODEL_NAME = "deepseek-chat";
const DEFAULT_SAMPLE_CASE_ID = "case-default";

const generateCaseId = () => `case-${crypto.randomUUID()}`;

const readCaseId = () => {
  if (typeof window === "undefined") {
    return generateCaseId();
  }
  const existing = window.sessionStorage.getItem(CASE_ID_STORAGE_KEY)?.trim();
  if (existing) {
    return existing;
  }
  const next = generateCaseId();
  window.sessionStorage.setItem(CASE_ID_STORAGE_KEY, next);
  return next;
};

const persistCaseId = (caseId: string) => {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(CASE_ID_STORAGE_KEY, caseId);
  }
};

const readLlmConfig = (): LlmSessionConfig => {
  if (typeof window === "undefined") {
    return { apiKey: "", modelName: DEFAULT_LLM_MODEL_NAME };
  }
  const raw = window.sessionStorage.getItem(LLM_CONFIG_STORAGE_KEY);
  if (!raw) {
    return { apiKey: "", modelName: DEFAULT_LLM_MODEL_NAME };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LlmSessionConfig>;
    return {
      apiKey: parsed.apiKey ?? "",
      modelName: parsed.modelName?.trim() || DEFAULT_LLM_MODEL_NAME,
    };
  } catch {
    return { apiKey: "", modelName: DEFAULT_LLM_MODEL_NAME };
  }
};

const persistLlmConfig = (config: LlmSessionConfig) => {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(LLM_CONFIG_STORAGE_KEY, JSON.stringify(config));
  }
};

interface WorkbenchContextValue {
  caseId: string;
  llmConfig: LlmSessionConfig;
  systemStatus: SystemStatus | null;
  entryState: WorkspaceEntryState;
  isDefaultCase: boolean;
  snapshot: WorkbenchSnapshot | null;
  chatMessages: ChatMessage[];
  chatSending: boolean;
  loading: boolean;
  selectedNodeId: string | null;
  selectedNodeDetail: TopologyNodeDetail | null;
  detailLoading: boolean;
  apiError: string | null;
  apiFailure: ApiFailure | null;
  endpoints: ReturnType<typeof topologyApi.getEndpointMap>;
  selectNode: (nodeId: string | null) => Promise<void>;
  mergeNode: (nodeId: string) => Promise<void>;
  rejectNode: (nodeId: string) => Promise<void>;
  archiveNode: (nodeId: string) => Promise<void>;
  setViewingVersion: (nodeId: string) => Promise<void>;
  uploadFiles: (files: File[], relativePaths?: Array<string | null>) => Promise<Awaited<ReturnType<typeof topologyApi.uploadFiles>>>;
  removeFolder: (folderPath: string) => Promise<DeletionResponse>;
  deleteCase: (confirmText: string) => Promise<DeletionResponse>;
  updateLlmConfig: (next: LlmSessionConfig) => void;
  sendChatMessage: (message: string) => Promise<void>;
  refresh: () => Promise<void>;
  refreshSystemStatus: () => Promise<SystemStatus | null>;
  openDefaultCase: () => Promise<void>;
}

const WorkbenchContext = createContext<WorkbenchContextValue | undefined>(undefined);

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [caseId, setCaseId] = useState(readCaseId);
  const [llmConfig, setLlmConfig] = useState<LlmSessionConfig>(readLlmConfig);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [systemStatusLoading, setSystemStatusLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<WorkbenchSnapshot | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatSending, setChatSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiFailure, setApiFailure] = useState<ApiFailure | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeDetail, setSelectedNodeDetail] = useState<TopologyNodeDetail | null>(null);

  useEffect(() => {
    setChatMessages(snapshot?.chatMessages ?? []);
  }, [snapshot]);

  const rememberApiFailure = useCallback(() => {
    const failure = topologyApi.getLastFailure();
    setApiFailure(failure);
    setApiError(failure?.message ?? null);
  }, []);

  const refreshSystemStatus = useCallback(async () => {
    setSystemStatusLoading(true);
    try {
      const next = await topologyApi.getSystemStatus();
      setSystemStatus(next);
      rememberApiFailure();
      return next;
    } catch {
      const failure = topologyApi.getLastFailure();
      setSystemStatus(null);
      setApiFailure(failure);
      setApiError(failure?.message ?? "Failed to load system status");
      return null;
    } finally {
      setSystemStatusLoading(false);
    }
  }, [rememberApiFailure]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await topologyApi.getWorkbenchSnapshot(caseId);
      setSnapshot(next);
      rememberApiFailure();
    } catch (error) {
      const failure = topologyApi.getLastFailure();
      setApiFailure(failure);
      setApiError(failure?.message ?? (error instanceof Error ? error.message : "Failed to load workspace"));
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [caseId, rememberApiFailure]);

  useEffect(() => {
    void refreshSystemStatus();
    void refresh();
  }, [refresh, refreshSystemStatus]);

  const selectNode = useCallback(async (nodeId: string | null) => {
    setSelectedNodeId(nodeId);

    if (!nodeId) {
      setSelectedNodeDetail(null);
      return;
    }

    setDetailLoading(true);
    try {
      const detail = await topologyApi.getNodeDetail(nodeId);
      setSelectedNodeDetail(detail);
      rememberApiFailure();
    } catch (error) {
      const failure = topologyApi.getLastFailure();
      setApiFailure(failure);
      setApiError(failure?.message ?? (error instanceof Error ? error.message : "Failed to load node detail"));
      setSelectedNodeDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [rememberApiFailure]);

  const syncAfterMutation = useCallback(async (nodeId?: string) => {
    try {
      const next = await topologyApi.getWorkbenchSnapshot(caseId);
      setSnapshot(next);
      rememberApiFailure();
      if (nodeId) {
        const detail = await topologyApi.getNodeDetail(nodeId);
        setSelectedNodeId(nodeId);
        setSelectedNodeDetail(detail);
        rememberApiFailure();
      }
      await refreshSystemStatus();
    } catch (error) {
      const failure = topologyApi.getLastFailure();
      setApiFailure(failure);
      setApiError(failure?.message ?? (error instanceof Error ? error.message : "Failed to sync workspace"));
    }
  }, [caseId, rememberApiFailure, refreshSystemStatus]);

  const mergeNode = useCallback(
    async (nodeId: string) => {
      try {
        await topologyApi.mergeNode(nodeId);
        await syncAfterMutation(nodeId);
      } catch (error) {
        const failure = topologyApi.getLastFailure();
        setApiFailure(failure);
        setApiError(failure?.message ?? (error instanceof Error ? error.message : "Failed to merge node"));
      }
    },
    [syncAfterMutation],
  );

  const rejectNode = useCallback(
    async (nodeId: string) => {
      try {
        await topologyApi.rejectNode(nodeId);
        await syncAfterMutation(nodeId);
      } catch (error) {
        const failure = topologyApi.getLastFailure();
        setApiFailure(failure);
        setApiError(failure?.message ?? (error instanceof Error ? error.message : "Failed to reject node"));
      }
    },
    [syncAfterMutation],
  );

  const archiveNode = useCallback(
    async (nodeId: string) => {
      try {
        await topologyApi.archiveNode(nodeId);
        await syncAfterMutation(nodeId);
      } catch (error) {
        const failure = topologyApi.getLastFailure();
        setApiFailure(failure);
        setApiError(failure?.message ?? (error instanceof Error ? error.message : "Failed to archive node"));
      }
    },
    [syncAfterMutation],
  );

  const setViewingVersion = useCallback(
    async (nodeId: string) => {
      try {
        await topologyApi.setViewingVersion(caseId, nodeId);
        await syncAfterMutation(selectedNodeId ?? nodeId);
      } catch (error) {
        const failure = topologyApi.getLastFailure();
        setApiFailure(failure);
        setApiError(failure?.message ?? (error instanceof Error ? error.message : "Failed to switch viewing version"));
      }
    },
    [caseId, selectedNodeId, syncAfterMutation],
  );

  const uploadFiles = useCallback(async (files: File[], relativePaths: Array<string | null> = []) => {
    try {
      const result = await topologyApi.uploadFiles(caseId, files, relativePaths, llmConfig);
      setSnapshot(result.workbench);
      rememberApiFailure();
      await refreshSystemStatus();
      return result;
    } catch (error) {
      const failure = topologyApi.getLastFailure();
      const message = failure?.message ?? (error instanceof Error ? error.message : "Failed to upload files");
      setApiFailure(failure);
      setApiError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }, [caseId, llmConfig, rememberApiFailure, refreshSystemStatus]);

  const removeFolder = useCallback(async (folderPath: string) => {
    try {
      const result = await topologyApi.removeFolder(caseId, folderPath);
      setSnapshot(result.workbench);
      rememberApiFailure();
      await refreshSystemStatus();
      return result;
    } catch (error) {
      const failure = topologyApi.getLastFailure();
      const message = failure?.message ?? (error instanceof Error ? error.message : "Failed to remove folder");
      setApiFailure(failure);
      setApiError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }, [caseId, rememberApiFailure, refreshSystemStatus]);

  const deleteCase = useCallback(async (confirmText: string) => {
    try {
      const result = await topologyApi.deleteCase(caseId, confirmText);
      const nextCaseId = generateCaseId();
      persistCaseId(nextCaseId);
      setCaseId(nextCaseId);
      setSnapshot(null);
      setChatMessages([]);
      setSelectedNodeId(null);
      setSelectedNodeDetail(null);
      rememberApiFailure();
      await refreshSystemStatus();
      return result;
    } catch (error) {
      const failure = topologyApi.getLastFailure();
      const message = failure?.message ?? (error instanceof Error ? error.message : "Failed to delete workspace");
      setApiFailure(failure);
      setApiError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }, [caseId, rememberApiFailure, refreshSystemStatus]);

  const updateLlmConfig = useCallback((next: LlmSessionConfig) => {
    const normalized = {
      apiKey: next.apiKey.trim(),
      modelName: next.modelName.trim() || DEFAULT_LLM_MODEL_NAME,
    };
    persistLlmConfig(normalized);
    setLlmConfig(normalized);
  }, []);

  const sendChatMessage = useCallback(async (message: string) => {
    setChatSending(true);
    try {
      const result = await topologyApi.sendChatMessage(caseId, message, llmConfig);
      setChatMessages(result.messages);
      rememberApiFailure();
    } catch (error) {
      const failure = topologyApi.getLastFailure();
      const messageText = failure?.message ?? (error instanceof Error ? error.message : "Failed to send chat message");
      setApiFailure(failure);
      setApiError(messageText);
      throw error instanceof Error ? error : new Error(messageText);
    } finally {
      setChatSending(false);
    }
  }, [caseId, llmConfig, rememberApiFailure]);

  const openDefaultCase = useCallback(async () => {
    const nextCaseId = systemStatus?.workspace.defaultCaseId ?? DEFAULT_SAMPLE_CASE_ID;
    persistCaseId(nextCaseId);
    setCaseId(nextCaseId);
    setSnapshot(null);
    setChatMessages([]);
    setSelectedNodeId(null);
    setSelectedNodeDetail(null);
    setApiFailure(null);
    setApiError(null);
    setLoading(true);
    await refreshSystemStatus();
  }, [refreshSystemStatus, systemStatus?.workspace.defaultCaseId]);

  const isDefaultCase = caseId === (systemStatus?.workspace.defaultCaseId ?? DEFAULT_SAMPLE_CASE_ID);
  const entryState = useMemo<WorkspaceEntryState>(() => {
    if (systemStatusLoading) {
      return "loading";
    }
    if (!systemStatus) {
      return "backend_unreachable";
    }
    if (loading) {
      return "loading";
    }
    if ((snapshot?.documents.length ?? 0) > 0) {
      return "ready";
    }
    if (systemStatus.mode.demoDataAvailable && !isDefaultCase) {
      return "demo_available";
    }
    if (!systemStatus.llm.configured && !llmConfig.apiKey.trim()) {
      return "llm_not_configured";
    }
    return "workspace_empty";
  }, [isDefaultCase, llmConfig.apiKey, loading, snapshot?.documents.length, systemStatus, systemStatusLoading]);

  const value = useMemo<WorkbenchContextValue>(
    () => ({
      caseId,
      llmConfig,
      systemStatus,
      entryState,
      isDefaultCase,
      snapshot,
      chatMessages,
      chatSending,
      loading,
      selectedNodeId,
      selectedNodeDetail,
      detailLoading,
      apiError,
      apiFailure,
      endpoints: topologyApi.getEndpointMap(),
      selectNode,
      mergeNode,
      rejectNode,
      archiveNode,
      setViewingVersion,
      uploadFiles,
      removeFolder,
      deleteCase,
      updateLlmConfig,
      sendChatMessage,
      refresh,
      refreshSystemStatus,
      openDefaultCase,
    }),
    [
      archiveNode,
      apiError,
      apiFailure,
      caseId,
      chatMessages,
      chatSending,
      deleteCase,
      detailLoading,
      entryState,
      isDefaultCase,
      llmConfig,
      loading,
      mergeNode,
      openDefaultCase,
      refresh,
      refreshSystemStatus,
      rejectNode,
      removeFolder,
      selectNode,
      selectedNodeDetail,
      selectedNodeId,
      sendChatMessage,
      setViewingVersion,
      snapshot,
      systemStatus,
      updateLlmConfig,
      uploadFiles,
    ],
  );

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
}

export function useWorkbench() {
  const context = useContext(WorkbenchContext);

  if (!context) {
    throw new Error("useWorkbench must be used within WorkbenchProvider");
  }

  return context;
}
