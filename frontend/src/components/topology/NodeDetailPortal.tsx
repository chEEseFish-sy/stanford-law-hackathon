import { motion } from "framer-motion";
import {
  Archive,
  CheckCircle2,
  Download,
  FileText,
  GitBranch,
  History,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import type { DocumentMeta, TopologyNodeStatus } from "../../types/topology";
import type { TopologyNodeDetail } from "../../types/topology";
import { downloadCapTableCsv } from "../../utils/captableExport";
import { cn } from "../../utils/cn";

const statusStyles: Record<TopologyNodeStatus, string> = {
  processing: "bg-sky-50 text-sky-700 border-sky-200",
  trunk: "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft: "bg-violet-50 text-violet-700 border-violet-200",
  merged: "bg-indigo-50 text-indigo-700 border-indigo-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  archived: "bg-slate-100 text-slate-600 border-slate-200",
  deleted: "bg-slate-100 text-slate-500 border-slate-200",
  error: "bg-red-50 text-red-700 border-red-200",
};

interface NodeDetailPortalProps {
  detail: TopologyNodeDetail | null;
  loading: boolean;
  onClose: () => void;
  onMerge: (nodeId: string) => void;
  onReject: (nodeId: string) => void;
  onArchive: (nodeId: string) => void;
  onViewVersion: (nodeId: string) => void;
  documents: DocumentMeta[];
}

export function NodeDetailPortal({
  detail,
  loading,
  onClose,
  onMerge,
  onReject,
  onArchive,
  onViewVersion,
  documents,
}: NodeDetailPortalProps) {
  if (!detail) {
    return (
      <div className="w-[26rem] rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
        <div className="flex h-full min-h-[32rem] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
          <div className="space-y-3 px-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200/70 text-slate-500">
              <History className="h-6 w-6" />
            </div>
            <div className="text-lg font-semibold text-slate-800">双击拓扑节点查看详情</div>
            <div className="text-sm leading-6 text-slate-500">
              右侧 Portal 会展示文件摘要、结构化结果、证据来源、Cap Table 影响和可执行操作。
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.aside
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      className="w-[26rem] rounded-[28px] border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
                  statusStyles[detail.node.status],
                )}
              >
                {detail.node.status}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {detail.node.nodeType.replace(/_/g, " ")}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-950">{detail.node.label}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                节点连接真实业务实体，不直接保存大段内容。当前展示以人类可读形式组织。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            关闭
          </button>
        </div>
      </div>

      <div className="max-h-[calc(100vh-14rem)] space-y-6 overflow-y-auto px-6 py-5">
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">节点元信息</div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Node ID</dt>
              <dd className="mt-1 font-medium text-slate-900">{detail.node.id}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Entity</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {detail.node.entityType} · {detail.node.entityId}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Parent</dt>
              <dd className="mt-1 font-medium text-slate-900">{detail.node.parentId ?? "Root"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Updated</dt>
              <dd className="mt-1 font-medium text-slate-900">{detail.node.updatedAt.slice(0, 10)}</dd>
            </div>
          </dl>
        </section>

        {detail.document ? (
          <section className="space-y-4 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-900">
              <FileText className="h-4 w-4 text-indigo-500" />
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">文件概况</div>
            </div>
            <div className="space-y-2">
              <div className="text-base font-semibold text-slate-950">{detail.document.fileName}</div>
              <div className="text-sm leading-6 text-slate-600">{detail.document.summary}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-slate-500">文件类型</div>
                <div className="mt-1 font-medium text-slate-900">{detail.document.fileType}</div>
              </div>
              <div>
                <div className="text-slate-500">交易时间</div>
                <div className="mt-1 font-medium text-slate-900">{detail.document.transactionDate ?? "待确认"}</div>
              </div>
              <div>
                <div className="text-slate-500">处理状态</div>
                <div className="mt-1 font-medium text-slate-900">{detail.document.processingStatus}</div>
              </div>
              <div>
                <div className="text-slate-500">证据状态</div>
                <div className="mt-1 font-medium text-slate-900">{detail.document.evidenceStatus}</div>
              </div>
            </div>
          </section>
        ) : null}

        {detail.structuredResult ? (
          <section className="space-y-4 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-900">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">结构化结果</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {detail.structuredResult.captableImpactSummary}
            </div>
            <div className="space-y-2">
              {detail.structuredResult.evidenceFindings.map((finding) => (
                <div key={`${finding.field}-${finding.source}`} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-950">{finding.field}</div>
                      <div className="mt-1 text-sm text-slate-600">{finding.value}</div>
                    </div>
                    <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {Math.round(finding.confidence * 100)}%
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">来源：{finding.source}</div>
                  {finding.issue ? (
                    <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                      {finding.issue}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {detail.captableVersion ? (
          <section className="space-y-4 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-900">
              <GitBranch className="h-4 w-4 text-emerald-500" />
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Cap Table 版本</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-slate-950">{detail.captableVersion.versionName}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{detail.captableVersion.summary}</div>
                </div>
                <button
                  type="button"
                  onClick={() => downloadCapTableCsv(detail.captableVersion!, documents)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {detail.captableVersion.rows.map((row) => (
                <div
                  key={`${row.holderName}-${row.securityType}`}
                  className="grid grid-cols-[1.6fr,1fr,0.8fr] gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium text-slate-950">{row.holderName}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.securityType}</div>
                  </div>
                  <div className="font-medium text-slate-700">{row.shares.toLocaleString()} shares</div>
                  <div className="text-right font-semibold text-slate-950">{row.ownershipPercentage}%</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">相关节点</div>
          <div className="space-y-2">
            {detail.relatedNodes.map((node) => (
              <div key={node.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                <div className="font-medium text-slate-950">{node.label}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                  {node.nodeType.replace(/_/g, " ")} · {node.status}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="border-t border-slate-200 px-6 py-4">
        {loading ? (
          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-500">正在加载详情...</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onViewVersion(detail.node.id)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              <History className="h-4 w-4" />
              回溯查看
            </button>
            {detail.availableActions.includes("merge") ? (
              <button
                onClick={() => onMerge(detail.node.id)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                合并草案
              </button>
            ) : null}
            {detail.availableActions.includes("reject") ? (
              <button
                onClick={() => onReject(detail.node.id)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
              >
                <XCircle className="h-4 w-4" />
                否决草案
              </button>
            ) : null}
            {detail.availableActions.includes("archive") ? (
              <button
                onClick={() => onArchive(detail.node.id)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <Archive className="h-4 w-4" />
                归档节点
              </button>
            ) : null}
          </div>
        )}
      </div>
    </motion.aside>
  );
}
