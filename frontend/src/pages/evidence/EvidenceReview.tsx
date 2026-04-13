import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronRight,
  FileText,
  Info,
  Sparkles,
  X,
} from "lucide-react";
import { useWorkbench } from "../../context/WorkbenchContext";
import { cn } from "../../utils/cn";

export function EvidenceReview() {
  const { snapshot } = useWorkbench();
  const issues = useMemo(
    () =>
      (snapshot?.structuredResults ?? [])
        .flatMap((result) =>
          result.evidenceFindings
            .filter((finding) => finding.issue)
            .map((finding, index) => ({
              id: `${result.id}-${index}`,
              title: finding.field.replace(/_/g, " "),
              severity:
                finding.confidence > 0.94 ? "medium" : finding.confidence > 0.9 ? "high" : "low",
              description: finding.issue!,
              files: (snapshot?.documents ?? [])
                .filter((document) => document.id === result.documentId)
                .map((document) => document.fileName),
              date: result.effectiveDate ?? result.createdAt.slice(0, 10),
              status: "pending",
              explanation: result.aiExplanation,
              impact: result.captableImpactSummary,
              source: finding.source,
              confidence: `${Math.round(finding.confidence * 100)}%`,
              documentId: result.documentId,
            })),
        ),
    [snapshot],
  );
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedIssue && issues[0]) {
      setSelectedIssue(issues[0].id);
    }
  }, [issues, selectedIssue]);
  const currentIssue = issues.find((issue) => issue.id === selectedIssue) ?? issues[0] ?? null;
  const currentPreview =
    snapshot?.documentPreviews.find((preview) => preview.documentId === currentIssue?.documentId) ?? null;
  const currentComparison =
    snapshot?.documentComparisons.find((comparison) => comparison.currentDocumentId === currentIssue?.documentId) ??
    snapshot?.documentComparisons[0] ??
    null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="grid gap-6 xl:grid-cols-[0.8fr,1.1fr]"
    >
      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.05] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.26em] text-white/35">Step 2</div>
            <h3 className="mt-2 text-xl font-semibold text-white">Evidence review queue</h3>
          </div>
          <span className="rounded-full border border-orange-300/20 bg-orange-500/10 px-3 py-1 text-sm font-medium text-orange-100/85">
            {issues.length} pending
          </span>
        </div>

        <div className="space-y-4 p-4">
          {issues.map((issue) => (
            <button
              key={issue.id}
              onClick={() => setSelectedIssue(issue.id)}
              className={cn(
                "group w-full rounded-[24px] border p-5 text-left transition duration-200",
                selectedIssue === issue.id
                  ? "border-orange-300/35 bg-orange-500/10"
                  : "border-white/8 bg-black/18 hover:border-white/14 hover:bg-white/[0.05]",
              )}
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  "rounded-2xl p-3 shrink-0",
                  issue.severity === "high"
                    ? "bg-rose-500/14 text-rose-200"
                    : issue.severity === "medium"
                      ? "bg-amber-500/14 text-amber-200"
                      : "bg-white/8 text-white/75",
                )}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="truncate pr-4 text-base font-semibold text-white">{issue.title}</h4>
                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-white/52">
                      {issue.confidence}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/58">{issue.description}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-medium text-white/45">
                    <span className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1">
                      <FileText className="h-3.5 w-3.5" />
                      {issue.files[0]}
                    </span>
                    <span>{issue.date}</span>
                  </div>
                </div>
                <ChevronRight className={cn(
                  "h-5 w-5 shrink-0 transition duration-200",
                  selectedIssue === issue.id
                    ? "translate-x-1 text-orange-100"
                    : "text-white/25 group-hover:text-white/55",
                )} />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.05] backdrop-blur-xl">
        {currentIssue ? (
          <motion.div
            key={selectedIssue}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="border-b border-white/10 px-8 py-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.26em] text-orange-200/70">Client decision loop</div>
                  <h3 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">
                    {currentIssue.title}
                  </h3>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-white/58">
                    {currentIssue.description}
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/72">
                  Source: {currentIssue.source}
                </div>
              </div>
            </div>

            <div className="grid gap-6 p-8 xl:grid-cols-[1fr,0.95fr]">
              <div className="space-y-6">
                <div className="rounded-[28px] border border-white/10 bg-black/18 p-6">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <FileText className="h-4 w-4 text-orange-200" />
                    {currentIssue.files[0]}
                  </div>
                  <p className="mt-4 text-sm leading-7 text-white/68">
                    {currentPreview?.excerpt.split(currentPreview.highlightedPhrases[0]?.text ?? "").length === 2 ? (
                      <>
                        {currentPreview.excerpt.split(currentPreview.highlightedPhrases[0].text)[0]}
                        <span className="rounded-lg bg-orange-400/18 px-1 py-0.5 text-white">
                          {currentPreview.highlightedPhrases[0].text}
                        </span>
                        {currentPreview.excerpt.split(currentPreview.highlightedPhrases[0].text)[1]}
                      </>
                    ) : (
                      currentPreview?.excerpt ?? currentIssue.description
                    )}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {(currentPreview?.highlightedPhrases ?? []).map((phrase) => (
                      <span
                        key={`${phrase.sourceLabel}-${phrase.text}`}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs",
                          phrase.tone === "good"
                            ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
                            : phrase.tone === "bad"
                              ? "border-amber-300/25 bg-amber-500/10 text-amber-100"
                              : "border-white/10 bg-white/[0.06] text-white/70",
                        )}
                      >
                        {phrase.sourceLabel}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-black/18 p-6">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Info className="h-4 w-4 text-orange-200" />
                    AI explanation
                  </div>
                  <p className="mt-4 text-sm leading-7 text-white/62">{currentIssue.explanation}</p>
                  <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/58">
                    {currentIssue.impact}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[28px] border border-white/10 bg-black/18 p-6">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Sparkles className="h-4 w-4 text-orange-200" />
                    Previous vs current
                  </div>
                  <div className="mt-4 space-y-3">
                    {(currentComparison?.changes ?? []).map((change) => (
                      <div key={change.label} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-semibold text-white">{change.label}</div>
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]",
                              change.recommendation === "accept"
                                ? "bg-emerald-500/12 text-emerald-100"
                                : change.recommendation === "reject"
                                  ? "bg-rose-500/12 text-rose-100"
                                  : "bg-amber-500/12 text-amber-100",
                            )}
                          >
                            {change.recommendation}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Previous</div>
                            <div className="mt-2 text-sm text-white/62">{change.previousText}</div>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Current</div>
                            <div className="mt-2 text-sm text-white/84">{change.currentText}</div>
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-white/42">{change.sourceLabel}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button className="flex-1 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.08]">
                    <X className="mr-2 inline h-4 w-4" />
                    Hold for client
                  </button>
                  <button className="flex-1 rounded-[20px] border border-orange-300/30 bg-orange-500/12 px-4 py-3 text-sm font-medium text-white transition hover:bg-orange-500/18">
                    <Check className="mr-2 inline h-4 w-4" />
                    Accept latest change
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="flex min-h-[420px] flex-col items-center justify-center text-white/42">
            <AlertCircle className="h-12 w-12 text-white/20" />
            <p className="mt-4 text-lg font-medium">Select an issue to review the source evidence.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
