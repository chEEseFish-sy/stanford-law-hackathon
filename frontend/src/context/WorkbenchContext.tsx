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
import type { ChatMessage, TopologyNodeDetail, WorkbenchSnapshot } from "../types/topology";

interface WorkbenchContextValue {
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
  removeFolder: (folderPath: string) => Promise<Awaited<ReturnType<typeof topologyApi.removeFolder>>>;
  sendChatMessage: (message: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const WorkbenchContext = createContext<WorkbenchContextValue | undefined>(undefined);

export function WorkbenchProvider({ children }: { children: ReactNode }) {
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
      const next = await topologyApi.getWorkbenchSnapshot();
      setSnapshot(next);
      setApiError(topologyApi.getLastError());
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, []);

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
      const next = await topologyApi.getWorkbenchSnapshot();
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
  }, []);

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
        await topologyApi.setViewingVersion(nodeId);
        await syncAfterMutation(selectedNodeId ?? nodeId);
      } catch (error) {
        setApiError(error instanceof Error ? error.message : "Failed to switch viewing version");
      }
    },
    [selectedNodeId, syncAfterMutation],
  );

  const uploadFiles = useCallback(async (files: File[], relativePaths: Array<string | null> = []) => {
    try {
      const result = await topologyApi.uploadFiles(files, relativePaths);
      setSnapshot(result.workbench);
      setApiError(topologyApi.getLastError());
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload files";
      setApiError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }, []);

  const removeFolder = useCallback(async (folderPath: string) => {
    try {
      const result = await topologyApi.removeFolder(folderPath);
      setSnapshot(result.workbench);
      setApiError(topologyApi.getLastError());
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove folder";
      setApiError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }, []);

  const sendChatMessage = useCallback(async (message: string) => {
    setChatSending(true);
    try {
      const result = await topologyApi.sendChatMessage(message);
      setChatMessages(result.messages);
      setApiError(topologyApi.getLastError());
    } catch (error) {
      const failure = error instanceof Error ? error.message : "Failed to send chat message";
      setApiError(failure);
      throw error instanceof Error ? error : new Error(failure);
    } finally {
      setChatSending(false);
    }
  }, []);

  const value = useMemo<WorkbenchContextValue>(
    () => ({
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
      sendChatMessage,
      refresh,
    }),
    [
      archiveNode,
      apiError,
      chatMessages,
      chatSending,
      detailLoading,
      loading,
      mergeNode,
      refresh,
      rejectNode,
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
