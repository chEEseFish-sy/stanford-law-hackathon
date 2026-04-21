import type { ChatMessage, DeletionResponse, LlmSessionConfig, TopologyNodeDetail, WorkbenchSnapshot } from "../../types/topology";

let lastError: string | null = null;

const API_BASE_URL =
  (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ??
  "http://127.0.0.1:8000";

const appendLlmConfig = (formData: FormData, llmConfig?: LlmSessionConfig | null) => {
  const apiKey = llmConfig?.apiKey.trim() ?? "";
  const modelName = llmConfig?.modelName.trim() ?? "";
  if (apiKey) {
    formData.append("use_llm", "true");
    formData.append("llm_api_key", apiKey);
  }
  if (modelName) {
    formData.append("llm_model_name", modelName);
  }
};

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    const message = `API ${path} failed (${response.status})`;
    lastError = message;
    throw new Error(message);
  }
  lastError = null;
  return (await response.json()) as T;
};

export const topologyApi = {
  async getWorkbenchSnapshot(caseId: string) {
    return await requestJson<WorkbenchSnapshot>(`/api/workbench?case_id=${caseId}`);
  },

  async getCaseTopology(caseId: string) {
    return await requestJson<WorkbenchSnapshot["topology"]>(`/api/cases/${caseId}/topology`);
  },

  async getNodeDetail(nodeId: string) {
    return await requestJson<TopologyNodeDetail>(`/api/topology/nodes/${nodeId}/detail`);
  },

  async mergeNode(nodeId: string) {
    return await requestJson<WorkbenchSnapshot>(`/api/topology/nodes/${nodeId}/merge`, {
      method: "POST",
    });
  },

  async rejectNode(nodeId: string) {
    return await requestJson<WorkbenchSnapshot>(`/api/topology/nodes/${nodeId}/reject`, {
      method: "POST",
    });
  },

  async archiveNode(nodeId: string) {
    return await requestJson<WorkbenchSnapshot>(`/api/topology/nodes/${nodeId}/archive`, {
      method: "POST",
    });
  },

  async setViewingVersion(caseId: string, nodeId: string) {
    const formData = new FormData();
    formData.append("node_id", nodeId);
    return await requestJson<WorkbenchSnapshot>(`/api/cases/${caseId}/viewing-version`, {
      method: "POST",
      body: formData,
    });
  },

  async uploadFiles(caseId: string, files: File[], relativePaths: Array<string | null> = [], llmConfig?: LlmSessionConfig | null) {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append(
      "file_paths",
      JSON.stringify(
        files.map((_, index) => ({
          relativePath: relativePaths[index] ?? null,
        })),
      ),
    );
    appendLlmConfig(formData, llmConfig);
    const response = await fetch(`${API_BASE_URL}/api/cases/${caseId}/files`, {
      method: "POST",
      body: formData,
    });
    const data = (await response.json()) as {
      processed: Array<{ source_file: string; status: string; output_file: string }>;
      failures: Array<{ source_file: string; error: string }>;
      index: unknown;
      topology_updates: Array<{ document_id: string; node_id: string; captable_version_id: string | null }>;
      workbench: WorkbenchSnapshot;
    };
    if (!response.ok && (!Array.isArray(data.failures) || data.failures.length === 0)) {
      const message = `API /api/cases/${caseId}/files failed (${response.status})`;
      lastError = message;
      throw new Error(message);
    }
    lastError = data.failures.length > 0 ? data.failures.map((failure) => failure.error).join("; ") : null;
    return data;
  },

  getDocumentDownloadUrl(caseId: string, documentId: string) {
    return `${API_BASE_URL}/api/cases/${caseId}/documents/${documentId}/download`;
  },

  async removeFolder(caseId: string, folderPath: string) {
    return await requestJson<DeletionResponse>(`/api/cases/${caseId}/folders/remove`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ folderPath }),
    });
  },

  async deleteCase(caseId: string, confirmText: string) {
    return await requestJson<DeletionResponse>(`/api/cases/${caseId}/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirmText }),
    });
  },

  async sendChatMessage(caseId: string, message: string, llmConfig?: LlmSessionConfig | null) {
    return await requestJson<{
      reply: ChatMessage;
      messages: ChatMessage[];
    }>(`/api/cases/${caseId}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        llmApiKey: llmConfig?.apiKey.trim() || null,
        llmModelName: llmConfig?.modelName.trim() || null,
      }),
    });
  },

  getLastError() {
    return lastError;
  },

  getEndpointMap() {
    return {
      getTopology: "GET /api/cases/:caseId/topology",
      getNodeDetail: "GET /api/topology/nodes/:nodeId/detail",
      uploadFiles: "POST /api/cases/:caseId/files",
      removeFolder: "POST /api/cases/:caseId/folders/remove",
      deleteCase: "POST /api/cases/:caseId/delete",
      sendChatMessage: "POST /api/cases/:caseId/chat",
      mergeDraft: "POST /api/topology/nodes/:nodeId/merge",
      rejectDraft: "POST /api/topology/nodes/:nodeId/reject",
      archiveNode: "POST /api/topology/nodes/:nodeId/archive",
      switchViewingVersion: "POST /api/cases/:caseId/viewing-version",
    };
  },
};
