import type {
  ApiErrorCategory,
  ApiFailure,
  ChatMessage,
  DeletionResponse,
  LlmSessionConfig,
  SystemStatus,
  TopologyNodeDetail,
  WorkbenchSnapshot,
} from "../../types/topology";

let lastError: string | null = null;
let lastFailure: ApiFailure | null = null;

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

const buildFailure = (category: ApiErrorCategory, message: string, statusCode?: number, detail?: string): ApiFailure => ({
  category,
  message,
  statusCode,
  detail,
});

const rememberFailure = (failure: ApiFailure | null) => {
  lastFailure = failure;
  lastError = failure?.message ?? null;
};

const categorizeStatus = (status: number): ApiErrorCategory => {
  if (status === 404) {
    return "not_found";
  }
  if (status >= 400 && status < 500) {
    return "validation_error";
  }
  if (status >= 500) {
    return "server_error";
  }
  return "unknown";
};

const extractErrorDetail = async (response: Response): Promise<string | undefined> => {
  try {
    const data = (await response.json()) as { detail?: string };
    return typeof data.detail === "string" ? data.detail : undefined;
  } catch {
    return undefined;
  }
};

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    const failure = buildFailure(
      "network_unreachable",
      "Backend is unavailable. Start the local services with `npm run dev`, then refresh.",
    );
    rememberFailure(failure);
    throw new Error(failure.message);
  }
  if (!response.ok) {
    const detail = await extractErrorDetail(response);
    const failure = buildFailure(
      categorizeStatus(response.status),
      detail ?? `API ${path} failed (${response.status})`,
      response.status,
      detail,
    );
    rememberFailure(failure);
    throw new Error(failure.message);
  }
  rememberFailure(null);
  return (await response.json()) as T;
};

export const topologyApi = {
  async getSystemStatus() {
    return await requestJson<SystemStatus>("/api/system-status");
  },

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
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/api/cases/${caseId}/files`, {
        method: "POST",
        body: formData,
      });
    } catch {
      const failure = buildFailure(
        "network_unreachable",
        "Upload could not start because the backend is unavailable. Start it with `npm run dev` and try again.",
      );
      rememberFailure(failure);
      throw new Error(failure.message);
    }
    const data = (await response.json()) as {
      processed: Array<{ source_file: string; status: string; output_file: string }>;
      failures: Array<{ source_file: string; error: string }>;
      index: unknown;
      topology_updates: Array<{ document_id: string; node_id: string; captable_version_id: string | null }>;
      workbench: WorkbenchSnapshot;
    };
    if (!response.ok && (!Array.isArray(data.failures) || data.failures.length === 0)) {
      const failure = buildFailure(
        categorizeStatus(response.status),
        `Upload failed on the server. Review the error and try the folder again.`,
        response.status,
      );
      rememberFailure(failure);
      throw new Error(failure.message);
    }
    if (data.failures.length > 0) {
      rememberFailure(
        buildFailure(
          "server_error",
          data.failures.map((failure) => `${failure.source_file}: ${failure.error}`).join("; "),
          response.status,
        ),
      );
    } else {
      rememberFailure(null);
    }
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

  getLastFailure() {
    return lastFailure;
  },

  getEndpointMap() {
    return {
      getSystemStatus: "GET /api/system-status",
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
