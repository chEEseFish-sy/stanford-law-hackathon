export type TopologyNodeStatus =
  | "processing"
  | "trunk"
  | "draft"
  | "merged"
  | "rejected"
  | "archived"
  | "deleted"
  | "error";

export type TopologyNodeType =
  | "document"
  | "draft_document"
  | "finalized_document"
  | "captable_version"
  | "analysis_result";

export type TopologyEntityType = "file" | "transaction" | "captable" | "analysis";

export type FileType =
  | "finalized_transaction"
  | "draft_transaction"
  | "board_resolution"
  | "side_letter"
  | "other";

export type ProcessingStatus =
  | "pending"
  | "processing"
  | "processed"
  | "needs_review"
  | "error";

export type EvidenceStatus = "unverified" | "verified" | "conflict" | "rejected";

export type CapTableStatus = "current" | "historical" | "draft" | "rejected" | "archived";

export type RefType = "depends_on" | "conflicts_with" | "derived_from" | "references";

export interface TopologyNode {
  id: string;
  parentId: string | null;
  children: string[];
  refs: string[];
  depth: number;
  index: number;
  label: string;
  status: TopologyNodeStatus;
  nodeType: TopologyNodeType;
  entityId: string;
  entityType: TopologyEntityType;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentMeta {
  id: string;
  fileName: string;
  fileType: FileType;
  transactionDate?: string;
  uploadedAt: string;
  sourcePath: string;
  relativePath?: string | null;
  folderPath?: string | null;
  storageProvider: "local" | "private_db" | "object_storage";
  processingStatus: ProcessingStatus;
  evidenceStatus: EvidenceStatus;
  summary: string;
}

export interface StructuredResult {
  id: string;
  documentId: string;
  transactionType: string;
  parties: string[];
  effectiveDate?: string;
  captableImpactSummary: string;
  extractedTerms: Array<{
    name: string;
    value: string;
    sourceLocation: string;
  }>;
  evidenceFindings: Array<{
    field: string;
    value: string;
    source: string;
    confidence: number;
    issue?: string;
  }>;
  aiExplanation: string;
  createdAt: string;
}

export interface CapTableVersion {
  id: string;
  topologyNodeId: string;
  parentVersionId?: string;
  versionName: string;
  generatedFromDocumentIds: string[];
  status: CapTableStatus;
  summary: string;
  projections: string[];
  rows: Array<{
    holderName: string;
    securityType: string;
    shares: number;
    ownershipPercentage: number;
    sourceDocumentId: string;
    sourceLocation: string;
    eventIds: string[];
    evidenceIds: string[];
    confidence: number;
    reviewStatus: string;
    viewType: string;
    eventStatus: string;
    statusMeaning: string;
    shareClass: string;
    series: string;
  }>;
  createdAt: string;
}

export interface TopologyRef {
  fromNodeId: string;
  toNodeId: string;
  refType: RefType;
}

export interface TopologyResponse {
  nodes: TopologyNode[];
  refs: TopologyRef[];
  currentTrunkNodeId: string;
  currentViewingNodeId: string;
}

export interface TopologyNodeDetail {
  node: TopologyNode;
  document?: DocumentMeta;
  structuredResult?: StructuredResult;
  captableVersion?: CapTableVersion;
  relatedNodes: TopologyNode[];
  availableActions: Array<"merge" | "reject" | "archive" | "view">;
}

export interface OperationLog {
  id: string;
  action: "upload" | "merge" | "reject" | "archive" | "view";
  nodeId: string;
  description: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface DocumentPreview {
  documentId: string;
  title: string;
  excerpt: string;
  highlightedPhrases: Array<{
    text: string;
    sourceLabel: string;
    tone: "neutral" | "good" | "bad";
  }>;
}

export interface DocumentComparison {
  id: string;
  previousDocumentId: string;
  currentDocumentId: string;
  title: string;
  summary: string;
  assessment: "good" | "bad" | "needs_review";
  changes: Array<{
    label: string;
    previousText: string;
    currentText: string;
    sourceLabel: string;
    recommendation: "accept" | "reject" | "review";
  }>;
}

export interface WorkspaceSummary {
  caseId: string;
  caseName: string;
  currentTrunkNodeId: string;
  currentViewingNodeId: string;
}

export interface WorkbenchSnapshot {
  workspace: WorkspaceSummary;
  topology: TopologyResponse;
  documents: DocumentMeta[];
  structuredResults: StructuredResult[];
  captableVersions: CapTableVersion[];
  operationLogs: OperationLog[];
  chatMessages: ChatMessage[];
  documentPreviews: DocumentPreview[];
  documentComparisons: DocumentComparison[];
}

export interface DeletionResponse {
  scopeType: "folder" | "case";
  scopeRef: string;
  removedCounts: {
    files: number;
    structuredResults: number;
    captableVersions: number;
    messages: number;
  };
  deletionEventId: string;
  workbench: WorkbenchSnapshot | null;
}

export interface LlmSessionConfig {
  apiKey: string;
  modelName: string;
}

export type WorkspaceEntryState =
  | "ready"
  | "backend_unreachable"
  | "loading"
  | "demo_available"
  | "workspace_empty"
  | "llm_not_configured";

export type ApiErrorCategory =
  | "network_unreachable"
  | "server_error"
  | "validation_error"
  | "not_found"
  | "unknown";

export interface ApiFailure {
  category: ApiErrorCategory;
  message: string;
  statusCode?: number;
  detail?: string;
}

export interface SystemStatus {
  api: {
    status: "ok";
  };
  workspace: {
    defaultCaseId: string;
    defaultCaseAvailable: boolean;
    defaultCaseName: string;
  };
  llm: {
    configured: boolean;
    modelName: string;
  };
  mode: {
    demoDataAvailable: boolean;
    storage: "local";
  };
}
