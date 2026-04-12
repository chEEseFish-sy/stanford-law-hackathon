import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Check, X, Info, FileText, ChevronRight } from "lucide-react";
import { cn } from "../../utils/cn";

export function EvidenceReview() {
  const [selectedIssue, setSelectedIssue] = useState<number | null>(1);

  const issues = [
    {
      id: 1,
      title: "Missing Stockholder Consent",
      severity: "high",
      description: "Priced Round Approval is missing required stockholder consent signatures.",
      files: ["Board_Consent_Seed_Round.pdf"],
      date: "Jun 01, 2023",
      status: "pending"
    },
    {
      id: 2,
      title: "Valuation Cap Mismatch",
      severity: "medium",
      description: "SAFE Note valuation cap is stated as $5M in SPA but $6M in Cap Table draft.",
      files: ["SAFE_Agreement_Alice.pdf", "Cap_Table_Draft_vFinal.xlsx"],
      date: "Jan 15, 2023",
      status: "pending"
    },
    {
      id: 3,
      title: "Unrecorded Option Pool Increase",
      severity: "low",
      description: "Board approved 10% option pool increase not reflected in the working cap table.",
      files: ["Board_Consent_Seed_Round.pdf"],
      date: "Jun 01, 2023",
      status: "resolved"
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-6 h-[calc(100vh-8rem)]"
    >
      <div className="w-1/2 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900">Review Queue</h3>
          <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold shadow-sm">
            {issues.filter(i => i.status === 'pending').length} Pending
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {issues.map((issue) => (
            <motion.div
              layoutId={`issue-${issue.id}`}
              key={issue.id}
              onClick={() => setSelectedIssue(issue.id)}
              className={cn(
                "p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 relative group",
                selectedIssue === issue.id 
                  ? "border-indigo-500 bg-indigo-50/30 shadow-md ring-4 ring-indigo-50" 
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-sm"
              )}
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  "p-2.5 rounded-lg shrink-0",
                  issue.severity === 'high' ? "bg-red-100 text-red-600" :
                  issue.severity === 'medium' ? "bg-amber-100 text-amber-600" :
                  "bg-blue-100 text-blue-600"
                )}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-base font-bold text-slate-900 truncate pr-4">{issue.title}</h4>
                    {issue.status === 'resolved' && (
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0">Resolved</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{issue.description}</p>
                  
                  <div className="mt-4 flex items-center gap-4 text-xs font-medium text-slate-500">
                    <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md">
                      <FileText className="w-3.5 h-3.5" />
                      {issue.files.length} File{issue.files.length > 1 ? 's' : ''}
                    </span>
                    <span className="text-slate-400">{issue.date}</span>
                  </div>
                </div>
                <ChevronRight className={cn(
                  "w-5 h-5 transition-transform duration-200 shrink-0",
                  selectedIssue === issue.id ? "text-indigo-500 translate-x-1" : "text-slate-300 group-hover:text-slate-400"
                )} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="w-1/2 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {selectedIssue ? (
            <motion.div
              key={selectedIssue}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col h-full"
            >
              <div className="p-8 border-b border-slate-200">
                <h3 className="text-2xl font-bold text-slate-900 mb-3">
                  {issues.find(i => i.id === selectedIssue)?.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {issues.find(i => i.id === selectedIssue)?.description}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50">
                <div>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Evidence Sources</h4>
                  <div className="space-y-3">
                    {issues.find(i => i.id === selectedIssue)?.files.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group">
                        <div className="bg-slate-100 p-2 rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                          <FileText className="w-5 h-5 text-slate-500 group-hover:text-indigo-600" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">{file}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="w-5 h-5 text-indigo-600" />
                    <h4 className="text-sm font-bold text-indigo-900 uppercase tracking-wider">AI Explanation</h4>
                  </div>
                  <p className="text-sm text-indigo-800 leading-relaxed mb-4">
                    The system detected that while the Board Consent was signed, the corresponding Stockholder Consent document is missing from the uploaded package. This is required for a priced round approval under Delaware law.
                  </p>
                  <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Suggested Action</span>
                    <span className="text-sm font-medium text-slate-700">Request the signed Stockholder Consent document from the client to verify the approval chain.</span>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 bg-white flex gap-4">
                <button className="flex-1 bg-white border-2 border-slate-200 text-slate-700 px-4 py-3 rounded-xl font-bold hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center justify-center gap-2">
                  <X className="w-5 h-5" /> Exclude
                </button>
                <button className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm hover:shadow flex items-center justify-center gap-2">
                  <Check className="w-5 h-5" /> Accept Suggestion
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <AlertCircle className="w-12 h-12 mb-4 text-slate-300" />
              <p className="text-lg font-medium">Select an issue to review evidence</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}