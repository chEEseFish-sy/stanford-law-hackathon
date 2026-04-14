import type { CapTableVersion, DocumentMeta } from "../types/topology";

const csvEscape = (value: string | number | undefined) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const safeFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "cap-table";

export function downloadCapTableCsv(version: CapTableVersion, documents: DocumentMeta[]) {
  const documentById = new Map(documents.map((document) => [document.id, document.fileName]));
  const rows = [
    [
      "Holder",
      "Security",
      "Shares",
      "Ownership Percentage",
      "Source Document",
      "Source Location",
      "Version",
      "Generated At",
    ],
    ...version.rows.map((row) => [
      row.holderName,
      row.securityType,
      row.shares,
      row.ownershipPercentage,
      documentById.get(row.sourceDocumentId) ?? row.sourceDocumentId,
      row.sourceLocation,
      version.versionName,
      version.createdAt,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFileName(version.versionName)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
