import { initialWorkbenchSnapshot } from "../../data/workbenchMockData";
import type {
  TopologyNode,
  TopologyNodeDetail,
  WorkbenchSnapshot,
} from "../../types/topology";

type SnapshotUpdater = (snapshot: WorkbenchSnapshot) => WorkbenchSnapshot;

let snapshot: WorkbenchSnapshot = structuredClone(initialWorkbenchSnapshot);
let lastError: string | null = null;

const API_BASE_URL =
  (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ??
  "http://127.0.0.1:8000";
const DEFAULT_CASE_ID = "case-default";

const delay = async (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    throw new Error(`API ${path} failed (${response.status})`);
  }
  lastError = null;
  return (await response.json()) as T;
};

const fallback = async <T>(operation: () => Promise<T>, error: unknown) => {
  lastError = error instanceof Error ? error.message : "Backend API unavailable";
  return operation();
};

const applySnapshot = (updater: SnapshotUpdater) => {
  snapshot = updater(snapshot);
  return structuredClone(snapshot);
};

const getNodeById = (state: WorkbenchSnapshot, nodeId: string) =>
  state.topology.nodes.find((node) => node.id === nodeId);

const buildNodeDetail = (state: WorkbenchSnapshot, nodeId: string): TopologyNodeDetail => {
  const node = getNodeById(state, nodeId);

  if (!node) {
    throw new Error(`Node ${nodeId} not found`);
  }

  const relatedNodes = state.topology.refs
    .filter((ref) => ref.fromNodeId === nodeId || ref.toNodeId === nodeId)
    .flatMap((ref) => [ref.fromNodeId, ref.toNodeId])
    .filter((id, index, ids) => ids.indexOf(id) === index && id !== nodeId)
    .map((id) => getNodeById(state, id))
    .filter(Boolean) as TopologyNode[];

  return {
    node,
    document: state.documents.find((document) => document.id === node.entityId),
    structuredResult: state.structuredResults.find(
      (result) =>
        result.documentId === node.entityId ||
        result.id === node.entityId,
    ),
    captableVersion: state.captableVersions.find((version) => version.id === node.entityId),
    relatedNodes,
    availableActions:
      node.status === "draft"
        ? ["merge", "reject", "archive", "view"]
        : node.status === "rejected"
          ? ["archive", "view"]
          : ["view"],
  };
};

const createMergedTrunkNode = (state: WorkbenchSnapshot, sourceNode: TopologyNode) => {
  const nextId = `node-trunk-${Date.now()}`;
  const versionId = `cap-${Date.now()}`;
  const parentId = state.topology.currentTrunkNodeId;

  const trunkNode: TopologyNode = {
    id: nextId,
    parentId,
    children: [],
    refs: [sourceNode.id],
    depth: sourceNode.depth + 1,
    index: state.topology.nodes.filter((node) => node.depth === sourceNode.depth + 1).length,
    label: `${sourceNode.label} · merged trunk`,
    status: "trunk",
    nodeType: "captable_version",
    entityId: versionId,
    entityType: "captable",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    trunkNode,
    captableVersion: {
      id: versionId,
      topologyNodeId: nextId,
      parentVersionId: state.captableVersions.find(
        (version) => version.topologyNodeId === state.topology.currentTrunkNodeId,
      )?.id,
      versionName: `${sourceNode.label} · merged version`,
      generatedFromDocumentIds: [
        ...state.documents
          .filter((document) => document.fileType !== "draft_transaction")
          .map((document) => document.id),
        sourceNode.entityId,
      ],
      status: "current" as const,
      summary: `Merged from ${sourceNode.label}.`,
      rows: state.captableVersions[state.captableVersions.length - 1]?.rows ?? [],
      createdAt: new Date().toISOString(),
    },
  };
};

export const topologyApi = {
  async getWorkbenchSnapshot() {
    try {
      snapshot = await requestJson<WorkbenchSnapshot>(`/api/workbench?case_id=${DEFAULT_CASE_ID}`);
      return structuredClone(snapshot);
    } catch (error) {
      return fallback(async () => {
        await delay();
        return structuredClone(snapshot);
      }, error);
    }
  },

  async getCaseTopology(caseId: string) {
    try {
      return await requestJson<WorkbenchSnapshot["topology"]>(`/api/cases/${caseId}/topology`);
    } catch (error) {
      return fallback(async () => {
        await delay();
        return structuredClone(snapshot.topology);
      }, error);
    }
  },

  async getNodeDetail(nodeId: string) {
    try {
      return await requestJson<TopologyNodeDetail>(`/api/topology/nodes/${nodeId}/detail`);
    } catch (error) {
      return fallback(async () => {
        await delay();
        return buildNodeDetail(snapshot, nodeId);
      }, error);
    }
  },

  async mergeNode(nodeId: string) {
    try {
      snapshot = await requestJson<WorkbenchSnapshot>(`/api/topology/nodes/${nodeId}/merge`, {
        method: "POST",
      });
      return structuredClone(snapshot);
    } catch (error) {
      return fallback(async () => {
        await delay();

        return applySnapshot((state) => {
          const target = getNodeById(state, nodeId);

          if (!target) {
            return state;
          }

          const { trunkNode, captableVersion } = createMergedTrunkNode(state, target);

          return {
            ...state,
            topology: {
              ...state.topology,
              currentTrunkNodeId: trunkNode.id,
              currentViewingNodeId: trunkNode.id,
              nodes: state.topology.nodes.map((node) =>
                node.id === nodeId
                  ? { ...node, status: "merged" as const, updatedAt: new Date().toISOString() }
                  : node.id === target.parentId
                    ? { ...node, children: [...node.children, trunkNode.id], updatedAt: new Date().toISOString() }
                    : node,
              ).concat(trunkNode),
            },
            workspace: {
              ...state.workspace,
              currentTrunkNodeId: trunkNode.id,
              currentViewingNodeId: trunkNode.id,
            },
            captableVersions: state.captableVersions
              .map((version) =>
                version.status === "current"
                  ? { ...version, status: "historical" as const }
                  : version,
              )
              .concat(captableVersion),
            operationLogs: [
              {
                id: `log-${Date.now()}`,
                action: "merge",
                nodeId,
                description: `Merged draft branch ${target.label} into trunk.`,
                createdAt: new Date().toISOString(),
              },
              ...state.operationLogs,
            ],
          };
        });
      }, error);
    }
  },

  async rejectNode(nodeId: string) {
    try {
      snapshot = await requestJson<WorkbenchSnapshot>(`/api/topology/nodes/${nodeId}/reject`, {
        method: "POST",
      });
      return structuredClone(snapshot);
    } catch (error) {
      return fallback(async () => {
        await delay();

        return applySnapshot((state) => ({
          ...state,
          topology: {
            ...state.topology,
            nodes: state.topology.nodes.map((node) =>
              node.id === nodeId
                ? { ...node, status: "rejected" as const, updatedAt: new Date().toISOString() }
                : node,
            ),
          },
          operationLogs: [
            {
              id: `log-${Date.now()}`,
              action: "reject",
              nodeId,
              description: `Rejected draft branch ${getNodeById(state, nodeId)?.label ?? nodeId}.`,
              createdAt: new Date().toISOString(),
            },
            ...state.operationLogs,
          ],
        }));
      }, error);
    }
  },

  async archiveNode(nodeId: string) {
    try {
      snapshot = await requestJson<WorkbenchSnapshot>(`/api/topology/nodes/${nodeId}/archive`, {
        method: "POST",
      });
      return structuredClone(snapshot);
    } catch (error) {
      return fallback(async () => {
        await delay();

        return applySnapshot((state) => ({
          ...state,
          topology: {
            ...state.topology,
            nodes: state.topology.nodes.map((node) =>
              node.id === nodeId
                ? { ...node, status: "archived" as const, updatedAt: new Date().toISOString() }
                : node,
            ),
          },
          operationLogs: [
            {
              id: `log-${Date.now()}`,
              action: "archive",
              nodeId,
              description: `Archived node ${getNodeById(state, nodeId)?.label ?? nodeId}.`,
              createdAt: new Date().toISOString(),
            },
            ...state.operationLogs,
          ],
        }));
      }, error);
    }
  },

  async setViewingVersion(nodeId: string) {
    const formData = new FormData();
    formData.append("node_id", nodeId);
    try {
      snapshot = await requestJson<WorkbenchSnapshot>(`/api/cases/${DEFAULT_CASE_ID}/viewing-version`, {
        method: "POST",
        body: formData,
      });
      return structuredClone(snapshot);
    } catch (error) {
      return fallback(async () => {
        await delay();

        return applySnapshot((state) => ({
          ...state,
          topology: {
            ...state.topology,
            currentViewingNodeId: nodeId,
          },
          workspace: {
            ...state.workspace,
            currentViewingNodeId: nodeId,
          },
          operationLogs: [
            {
              id: `log-${Date.now()}`,
              action: "view",
              nodeId,
              description: `Switched viewing version to ${getNodeById(state, nodeId)?.label ?? nodeId}.`,
              createdAt: new Date().toISOString(),
            },
            ...state.operationLogs,
          ],
        }));
      }, error);
    }
  },

  async uploadFiles(files: File[]) {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const data = await requestJson<{
      processed: Array<{ source_file: string; status: string; output_file: string }>;
      failures: Array<{ source_file: string; error: string }>;
      index: unknown;
      topology_updates: Array<{ document_id: string; node_id: string; captable_version_id: string | null }>;
      workbench: WorkbenchSnapshot;
    }>(`/api/cases/${DEFAULT_CASE_ID}/files`, {
      method: "POST",
      body: formData,
    });
    snapshot = data.workbench;
    return data;
  },

  getLastError() {
    return lastError;
  },

  getEndpointMap() {
    return {
      getTopology: "GET /api/cases/:caseId/topology",
      getNodeDetail: "GET /api/topology/nodes/:nodeId/detail",
      uploadFiles: "POST /api/cases/:caseId/files",
      mergeDraft: "POST /api/topology/nodes/:nodeId/merge",
      rejectDraft: "POST /api/topology/nodes/:nodeId/reject",
      archiveNode: "POST /api/topology/nodes/:nodeId/archive",
      switchViewingVersion: "POST /api/cases/:caseId/viewing-version",
    };
  },
};
