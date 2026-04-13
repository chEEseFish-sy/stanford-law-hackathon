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
import type { TopologyNodeDetail, WorkbenchSnapshot } from "../types/topology";

interface WorkbenchContextValue {
  snapshot: WorkbenchSnapshot | null;
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
  uploadFiles: (files: File[]) => Promise<Awaited<ReturnType<typeof topologyApi.uploadFiles>>>;
  refresh: () => Promise<void>;
}

const WorkbenchContext = createContext<WorkbenchContextValue | undefined>(undefined);

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<WorkbenchSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeDetail, setSelectedNodeDetail] = useState<TopologyNodeDetail | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await topologyApi.getWorkbenchSnapshot();
    setSnapshot(next);
    setApiError(topologyApi.getLastError());
    setLoading(false);
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
      const detail = await topologyApi.getNodeDetail(nodeId);
      setSelectedNodeDetail(detail);
      setApiError(topologyApi.getLastError());
      setDetailLoading(false);
    }, []);

  const syncAfterMutation = useCallback(async (nodeId?: string) => {
    const next = await topologyApi.getWorkbenchSnapshot();
    setSnapshot(next);
    setApiError(topologyApi.getLastError());

    if (nodeId) {
      const detail = await topologyApi.getNodeDetail(nodeId);
      setSelectedNodeId(nodeId);
      setSelectedNodeDetail(detail);
      setApiError(topologyApi.getLastError());
    }
  }, []);

  const mergeNode = useCallback(
    async (nodeId: string) => {
      await topologyApi.mergeNode(nodeId);
      await syncAfterMutation(nodeId);
    },
    [syncAfterMutation],
  );

  const rejectNode = useCallback(
    async (nodeId: string) => {
      await topologyApi.rejectNode(nodeId);
      await syncAfterMutation(nodeId);
    },
    [syncAfterMutation],
  );

  const archiveNode = useCallback(
    async (nodeId: string) => {
      await topologyApi.archiveNode(nodeId);
      await syncAfterMutation(nodeId);
    },
    [syncAfterMutation],
  );

  const setViewingVersion = useCallback(
    async (nodeId: string) => {
      await topologyApi.setViewingVersion(nodeId);
      await syncAfterMutation(selectedNodeId ?? nodeId);
    },
    [selectedNodeId, syncAfterMutation],
  );

  const uploadFiles = useCallback(async (files: File[]) => {
    const result = await topologyApi.uploadFiles(files);
    setSnapshot(result.workbench);
    setApiError(topologyApi.getLastError());
    return result;
  }, []);

  const value = useMemo<WorkbenchContextValue>(
    () => ({
      snapshot,
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
      refresh,
    }),
    [
      archiveNode,
      apiError,
      detailLoading,
      loading,
      mergeNode,
      refresh,
      rejectNode,
      selectNode,
      selectedNodeDetail,
      selectedNodeId,
      setViewingVersion,
      uploadFiles,
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
