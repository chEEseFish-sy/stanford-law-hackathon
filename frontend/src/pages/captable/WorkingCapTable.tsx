import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  History,
  Info,
  Sparkles,
} from "lucide-react";
import { useWorkbench } from "../../context/WorkbenchContext";
import type { TabKey } from "../../types/navigation";
import { cn } from "../../utils/cn";

export function WorkingCapTable({
  setActiveTab,
}: {
  setActiveTab: (tab: TabKey) => void;
}) {
  const { snapshot, setViewingVersion } = useWorkbench();
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const currentVersion = snapshot?.captableVersions.find(
    (version) => version.topologyNodeId === snapshot.topology.currentViewingNodeId,
  );
  const conflictLookup = useMemo(
    () =>
      new Map(
        (snapshot?.structuredResults ?? []).flatMap((result) =>
          result.evidenceFindings
            .filter((finding) => finding.issue)
            .map((finding) => [result.documentId, finding.issue] as const),
        ),
      ),
    [snapshot],
  );
  const versionNodes = snapshot?.topology.nodes.filter((node) => node.nodeType === "captable_version") ?? [];

  const toggleRow = (id: string) => {
    setExpandedRows((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id],
    );
  };

  const capTableData =
    currentVersion?.rows.map((row) => {
      const sourceDocument = snapshot?.documents.find((document) => document.id === row.sourceDocumentId);

      return {
        id: `${row.holderName}-${row.securityType}`,
        shareholder: row.holderName,
        role: row.securityType.includes("Common") ? "Founder" : "Investor",
        securityClass: row.securityType,
        shares: row.shares.toLocaleString(),
        ownership: `${row.ownershipPercentage}%`,
        status: conflictLookup.has(row.sourceDocumentId) ? "needs_review" : "confirmed",
        conflict: conflictLookup.get(row.sourceDocumentId),
        details: [
          { label: "Source Document", value: sourceDocument?.fileName ?? row.sourceDocumentId },
          { label: "Source Location", value: row.sourceLocation },
          { label: "Generated From Version", value: currentVersion.versionName },
        ],
      };
    }) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <div className="rounded-[32px] border border-white/10 bg-white/[0.05] backdrop-blur-xl">
        <div className="grid gap-6 border-b border-white/10 px-6 py-6 xl:grid-cols-[1fr,0.9fr]">
          <div>
            <div className="text-[11px] uppercase tracking-[0.26em] text-white/35">Step 3</div>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">Build the working cap table</h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/58">
              This is a working result, not the final legal truth. Every row keeps its document source, and the user can roll back to an earlier version at any time.
            </p>
          </div>

          <div className="rounded-[28px] border border-orange-300/18 bg-orange-500/10 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <History className="h-4 w-4 text-orange-200" />
              Roll back or switch versions
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {versionNodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => void setViewingVersion(node.id)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm transition",
                    snapshot?.topology.currentViewingNodeId === node.id
                      ? "border-orange-300/35 bg-white/10 text-white"
                      : "border-white/10 bg-black/20 text-white/65 hover:bg-white/[0.06]",
                  )}
                >
                  {node.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto px-6 py-6">
          <table className="w-full text-left">
            <thead className="text-xs uppercase tracking-[0.18em] text-white/35">
              <tr className="border-b border-white/10">
                <th className="py-4 pl-4 pr-4 w-12"></th>
                <th className="py-4 px-4">Holder</th>
                <th className="py-4 px-4">Security</th>
                <th className="py-4 px-4 text-right">Shares</th>
                <th className="py-4 px-4 text-right">Ownership</th>
                <th className="py-4 px-4">Source</th>
                <th className="py-4 pr-4 pl-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-white/78">
              {capTableData.map((row) => {
                const isExpanded = expandedRows.includes(row.id);
                return (
                  <AnimatePresence key={row.id} initial={false}>
                    <tr 
                      className={cn(
                        "group cursor-pointer border-b border-white/8 transition-colors hover:bg-white/[0.03]",
                        isExpanded ? "bg-white/[0.04]" : "",
                      )}
                      onClick={() => toggleRow(row.id)}
                    >
                      <td className="py-4 pl-4 pr-4">
                        <button className="rounded-lg p-1 text-white/45 transition hover:bg-white/[0.08] hover:text-white/70">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-white">{row.shareholder}</div>
                        <div className="mt-0.5 text-xs text-white/42">{row.role}</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium",
                          row.securityClass.includes("Preferred")
                            ? "bg-emerald-500/12 text-emerald-100"
                            : "bg-orange-500/12 text-orange-100",
                        )}>
                          {row.securityClass}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-white">{row.shares}</td>
                      <td className="py-4 px-4 text-right text-white/62">{row.ownership}</td>
                      <td className="py-4 px-4 text-white/52">{row.details[0].value}</td>
                      <td className="py-4 pr-4 pl-4 text-center">
                        {row.status === "confirmed" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-100">
                            Confirmed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.18em] text-amber-100">
                            <AlertTriangle className="h-3.5 w-3.5" /> Review
                          </span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="border-b border-white/8 bg-black/18"
                      >
                        <td colSpan={7} className="p-0">
                          <div className="grid gap-4 px-16 py-6 xl:grid-cols-[1fr,0.7fr]">
                            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                <Info className="h-4 w-4 text-orange-200" />
                                Why this row exists
                              </div>
                              <div className="mt-4 grid gap-4 md:grid-cols-3">
                                {row.details.map((detail) => (
                                  <div key={detail.label}>
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">{detail.label}</div>
                                    <div className="mt-2 text-sm text-white/78">{detail.value}</div>
                                  </div>
                                ))}
                              </div>
                              <button className="mt-5 rounded-full border border-orange-300/25 bg-orange-500/10 px-4 py-2 text-sm text-white transition hover:bg-orange-500/18">
                                <Sparkles className="mr-2 inline h-4 w-4" />
                                Explain with AI
                              </button>
                            </div>
                            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                              <div className="text-sm font-semibold text-white">Decision support</div>
                              {row.conflict ? (
                                <>
                                  <p className="mt-3 text-sm leading-7 text-amber-100/85">{row.conflict}</p>
                                  <button
                                    onClick={() => setActiveTab("review")}
                                    className="mt-5 rounded-full border border-amber-300/25 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-500/16"
                                  >
                                    Resolve in Step 2
                                  </button>
                                </>
                              ) : (
                                <p className="mt-3 text-sm leading-7 text-white/58">
                                  The supporting documents are internally consistent for this row.
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                );
              })}
            </tbody>
            <tfoot className="border-t border-white/10">
              <tr>
                <td colSpan={4} className="py-4 pl-4 pr-4 text-right text-sm uppercase tracking-[0.18em] text-white/35">
                  Total fully diluted
                </td>
                <td className="py-4 px-4 text-right text-base font-semibold text-white">
                  {(currentVersion?.rows.reduce((sum, row) => sum + row.shares, 0) ?? 0).toLocaleString()}
                </td>
                <td className="py-4 px-4 text-right text-white/55">100.00%</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
