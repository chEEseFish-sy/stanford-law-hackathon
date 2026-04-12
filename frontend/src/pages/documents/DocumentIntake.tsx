import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, FileText, Calendar, Tag, MoreVertical, AlertCircle } from "lucide-react";
import { cn } from "../../utils/cn";

type Evidence = {
  paragraph_id: number;
  source_text: string;
};

type IndexedDocument = {
  source_file: string;
  document_title: string;
  document_type: string;
  key_dates: Array<{
    date_original?: string;
    date_iso?: string | null;
    meaning?: string;
    evidence?: Evidence[];
  }>;
  main_parties: Array<{
    name?: string;
    role?: string;
    evidence?: Evidence[];
  }>;
  confidence: number;
  status: string;
  output_file: string;
};

type DocumentIndex = {
  document_count: number;
  documents: IndexedDocument[];
};

const API_BASE_URL =
  (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ??
  "http://127.0.0.1:8000";

export function DocumentIntake() {
  const [documents, setDocuments] = useState<IndexedDocument[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const hasSelection = selectedFiles.length > 0;

  const selectedLabel = useMemo(() => {
    if (selectedFiles.length === 0) {
      return "DOCX transaction documents";
    }
    if (selectedFiles.length === 1) {
      return selectedFiles[0].name;
    }
    return `${selectedFiles.length} documents selected`;
  }, [selectedFiles]);

  useEffect(() => {
    void loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents`);
      if (!response.ok) {
        throw new Error(`Failed to load documents (${response.status})`);
      }
      const data = (await response.json()) as DocumentIndex;
      setDocuments(data.documents ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load processed documents");
    } finally {
      setIsLoading(false);
    }
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) =>
      file.name.toLowerCase().endsWith(".docx")
    );
    setSelectedFiles(files);
    setMessage(null);
    setError(files.length === 0 && event.target.files?.length ? "Only .docx files are supported" : null);
  };

  const uploadSelectedFiles = async () => {
    if (!hasSelection) {
      inputRef.current?.click();
      return;
    }

    setIsUploading(true);
    setMessage(null);
    setError(null);
    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = data?.failures?.[0]?.error ?? data?.detail ?? `Upload failed (${response.status})`;
        throw new Error(detail);
      }
      setDocuments(data.index?.documents ?? []);
      setSelectedFiles([]);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      setMessage(`${data.processed?.length ?? 0} document(s) saved and processed`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-white border-2 border-dashed border-slate-300 rounded-lg p-10 text-center hover:bg-slate-50 hover:border-indigo-400 transition-colors">
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          onChange={onFileChange}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mx-auto mb-6 hover:bg-indigo-100 transition-colors"
        >
          <UploadCloud className="w-8 h-8" />
        </button>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Upload Transaction Documents</h3>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">
          Save original DOCX files, extract candidate evidence, and prepare structured data for review.
        </p>
        <div className="mb-5 text-sm font-semibold text-slate-700">{selectedLabel}</div>
        <button
          type="button"
          disabled={isUploading}
          onClick={uploadSelectedFiles}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isUploading ? "Processing..." : hasSelection ? "Save and Process" : "Select Files"}
        </button>
        {(message || error) && (
          <div
            className={cn(
              "mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold",
              error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
            )}
          >
            {error && <AlertCircle className="h-4 w-4" />}
            {error ?? message}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Document Organization</h3>
          <button
            type="button"
            onClick={() => void loadDocuments()}
            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-4 pl-6 pr-4">File Name</th>
                <th className="py-4 px-4">Document Type</th>
                <th className="py-4 px-4">Date</th>
                <th className="py-4 px-4">Parties</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 pr-6 pl-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Loading documents...
                  </td>
                </tr>
              )}
              {!isLoading && documents.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No processed documents yet.
                  </td>
                </tr>
              )}
              {!isLoading &&
                documents.map((doc) => (
                  <tr key={`${doc.source_file}-${doc.output_file}`} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-4 pl-6 pr-4">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-slate-400" />
                        <div>
                          <div className="text-slate-900 font-semibold">{doc.source_file}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{doc.document_title || "Untitled"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-bold">
                        <Tag className="w-3.5 h-3.5 text-slate-400" /> {doc.document_type || "Pending"}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-400" /> {formatKeyDate(doc)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-slate-600 font-semibold">{formatParties(doc)}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide",
                          doc.status === "processed_with_task_llm"
                            ? "bg-emerald-50 text-emerald-700"
                            : doc.status === "failed"
                              ? "bg-red-50 text-red-700"
                              : "bg-blue-50 text-blue-700"
                        )}
                      >
                        {doc.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-4 pr-6 pl-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function formatKeyDate(doc: IndexedDocument) {
  const firstDate = doc.key_dates?.[0];
  return firstDate?.date_iso ?? firstDate?.date_original ?? "Pending";
}

function formatParties(doc: IndexedDocument) {
  if (!doc.main_parties?.length) {
    return "Pending";
  }
  return doc.main_parties
    .slice(0, 2)
    .map((party) => party.name || party.role)
    .filter(Boolean)
    .join(", ");
}
