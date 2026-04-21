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
import type { ChatMessage, DeletionResponse, LlmSessionConfig, TopologyNodeDetail, WorkbenchSnapshot } from "../types/topology";

const CASE_ID_STORAGE_KEY = "vericap.case_id";
const LLM_CONFIG_STORAGE_KEY = "vericap.llm_config";
const DEFAULT_LLM_MODEL_NAME = "gemini-3-flash-preview";

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
  snapshot: WorkbenchSnapshot | null;
  chatMessages: ChatMessage[];
  chatSending: boolean;
  loading: boolean;
  selectedNodeId: string | null;
  selectedNodeDetail: TopologyNodeDetail | null;
  detailLoading: boolean;
  apiError: string | null;
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
}

const WorkbenchContext = createContext<WorkbenchContextValue | undefined>(undefined);

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [caseId, setCaseId] = useState(readCaseId);
  const [llmConfig, setLlmConfig] = useState<LlmSessionConfig>(readLlmConfig);
  const [snapshot, setSnapshot] = useState<WorkbenchSnapshot | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatSending, setChatSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeDetail, setSelectedNodeDetail] = useState<TopologyNodeDetail | null>(null);

  useEffect(() => {
    setChatMessages(snapshot?.chatMessages ?? []);
  }, [snapshot]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await topologyApi.getWorkbenchSnapshot(caseId);
      setSnapshot(next);
      setApiError(topologyApi.getLastError());
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      setApiError(topologyApi.getLastError());
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to load node detail");
      setSelectedNodeDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const syncAfterMutation = useCallback(async (nodeId?: string) => {
    try {
      const next = await topologyApi.getWorkbenchSnapshot(caseId);
      setSnapshot(next);
      setApiError(topologyApi.getLastError());
      if (nodeId) {
        const detail = await topologyApi.getNodeDetail(nodeId);
        setSelectedNodeId(nodeId);
        setSelectedNodeDetail(detail);
        setApiError(topologyApi.getLastError());
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to sync workspace");
    }
  }, [caseId]);

  const mergeNode = useCallback(
    async (nodeId: string) => {
      try {
        await topologyApi.mergeNode(nodeId);
        await syncAfterMutation(nodeId);
      } catch (error) {
        setApiError(error instanceof Error ? error.message : "Failed to merge node");
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
        setApiError(error instanceof Error ? error.message : "Failed to reject node");
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
        setApiError(error instanceof Error ? error.message : "Failed to archive node");
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
        setApiError(error instanceof Error ? error.message : "Failed to switch viewing version");
      }
    },
    [caseId, selectedNodeId, syncAfterMutation],
  );

  const uploadFiles = useCallback(async (files: File[], relativePaths: Array<string | null> = []) => {
    try {
      const result = await topologyApi.uploadFiles(caseId, files, relativePaths, llmConfig);
      setSnapshot(result.workbench);
      setApiError(topologyApi.getLastError());
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload files";
      setApiError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }, [caseId, llmConfig]);

  const removeFolder = useCallback(async (folderPath: string) => {
    try {
      const result = await topologyApi.removeFolder(caseId, folderPath);
      setSnapshot(result.workbench);
      setApiError(topologyApi.getLastError());
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove folder";
      setApiError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }, [caseId]);

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
      setApiError(topologyApi.getLastError());
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete workspace";
      setApiError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }, [caseId]);

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
      setApiError(topologyApi.getLastError());
    } catch (error) {
      const failure = error instanceof Error ? error.message : "Failed to send chat message";
      setApiError(failure);
      throw error instanceof Error ? error : new Error(failure);
    } finally {
      setChatSending(false);
    }
  }, [caseId, llmConfig]);

  const value = useMemo<WorkbenchContextValue>(
    () => ({
      caseId,
      llmConfig,
      snapshot,
      chatMessages,
      chatSending,
      loading,
      selectedNodeId,
      selectedNodeDetail,
      detailLoading,
      apiError,
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
    }),
    [
      archiveNode,
      apiError,
      caseId,
      chatMessages,
      chatSending,
      detailLoading,
      llmConfig,
      loading,
      mergeNode,
      refresh,
      rejectNode,
      deleteCase,
      updateLlmConfig,
      sendChatMessage,
      selectNode,
      selectedNodeDetail,
      selectedNodeId,
      setViewingVersion,
      uploadFiles,
      removeFolder,
      snapshot,
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
