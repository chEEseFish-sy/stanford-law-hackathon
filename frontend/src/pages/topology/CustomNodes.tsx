import type { ReactNode } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import {
  Archive,
  CheckCircle2,
  FileCog,
  FileText,
  GitBranch,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { cn } from "../../utils/cn";

const statusBadge = {
  trunk: "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft: "bg-violet-50 text-violet-700 border-violet-200",
  merged: "bg-indigo-50 text-indigo-700 border-indigo-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  archived: "bg-slate-100 text-slate-600 border-slate-200",
  processing: "bg-sky-50 text-sky-700 border-sky-200",
  error: "bg-red-50 text-red-700 border-red-200",
};

const getStatusBadge = (status: unknown) =>
  statusBadge[(typeof status === "string" ? status : "processing") as keyof typeof statusBadge] ??
  statusBadge.processing;

function NodeShell({
  selected,
  children,
  className,
}: {
  selected: boolean;
  children: ReactNode;
  className: string;
}) {
  return (
    <div
      className={cn(
        "min-w-[260px] rounded-3xl border bg-white px-4 py-4 shadow-[0_20px_50px_rgba(15,23,42,0.12)] transition-all duration-200",
        selected ? "border-indigo-400 ring-4 ring-indigo-100" : "border-white/80 hover:-translate-y-0.5 hover:border-slate-300",
        className,
      )}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      {children}
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </div>
  );
}

export function DocumentNode({ data, selected }: NodeProps) {
  return (
    <NodeShell selected={selected} className="bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-950">{String(data.label)}</div>
            <div className="mt-1 text-xs text-slate-500">{String(data.meta ?? "Document node")}</div>
          </div>
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", getStatusBadge(data.status))}>
          {String(data.status)}
        </span>
      </div>
      <div className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-400">{String(data.nodeType)}</div>
    </NodeShell>
  );
}

export function EventNode({ data, selected }: NodeProps) {
  const Icon =
    data.status === "trunk"
      ? CheckCircle2
      : data.status === "draft"
        ? GitBranch
        : data.status === "rejected"
          ? XCircle
          : data.status === "archived"
            ? Archive
            : ShieldAlert;

  return (
    <NodeShell selected={selected} className="bg-gradient-to-br from-indigo-50 via-white to-violet-50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-950">{String(data.label)}</div>
            <div className="mt-1 text-xs text-slate-500">{String(data.meta ?? "Analysis or branch state")}</div>
          </div>
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", getStatusBadge(data.status))}>
          {String(data.status)}
        </span>
      </div>
      <div className="mt-4 rounded-2xl border border-indigo-100 bg-white/80 px-3 py-2 text-xs leading-5 text-slate-600">
        {String(data.description)}
      </div>
    </NodeShell>
  );
}

export function CapTableRowNode({ data, selected }: NodeProps) {
  return (
    <NodeShell selected={selected} className="bg-slate-950 text-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/10 p-3 text-emerald-300">
            <FileCog className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{String(data.label)}</div>
            <div className="mt-1 text-xs text-slate-400">{String(data.meta ?? "Cap table version")}</div>
          </div>
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", getStatusBadge(data.status))}>
          {String(data.status)}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Entity</span>
        <span className="text-sm font-medium text-emerald-300">{String(data.entityType)}</span>
      </div>
    </NodeShell>
  );
}
