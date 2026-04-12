import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Info, AlertTriangle } from "lucide-react";
import { cn } from "../../utils/cn";

export function WorkingCapTable() {
  const [expandedRows, setExpandedRows] = useState<number[]>([]);

  const toggleRow = (id: number) => {
    setExpandedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const capTableData = [
    {
      id: 1,
      shareholder: "Alice Founder",
      role: "Founder",
      securityClass: "Common",
      shares: "4,000,000",
      ownership: "40.00%",
      status: "confirmed",
      details: [
        { label: "Issuance Date", value: "Jan 01, 2022" },
        { label: "Source Doc", value: "Founder_Stock_Purchase_Alice.pdf" },
        { label: "Vesting", value: "4-year standard, 1-year cliff" }
      ]
    },
    {
      id: 2,
      shareholder: "Bob Founder",
      role: "Founder",
      securityClass: "Common",
      shares: "4,000,000",
      ownership: "40.00%",
      status: "confirmed",
      details: [
        { label: "Issuance Date", value: "Jan 01, 2022" },
        { label: "Source Doc", value: "Founder_Stock_Purchase_Bob.pdf" },
        { label: "Vesting", value: "4-year standard, 1-year cliff" }
      ]
    },
    {
      id: 3,
      shareholder: "Seed VC Fund I",
      role: "Investor",
      securityClass: "Seed Preferred",
      shares: "2,000,000",
      ownership: "20.00%",
      status: "needs_review",
      conflict: "Missing Board Consent for priced round conversion.",
      details: [
        { label: "Conversion Date", value: "Jun 15, 2023" },
        { label: "Source Doc", value: "Stock_Purchase_Agreement_VC.pdf" },
        { label: "Original SAFE", value: "SAFE_Agreement_SeedVC.pdf" }
      ]
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Working Cap Table</h3>
            <p className="text-sm text-slate-500 mt-1">Fully Diluted Basis, showing current theoretical state.</p>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors shadow-sm">
              Export to Excel
            </button>
            <button className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm hover:shadow">
              Generate Audit Report
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-4 pl-6 pr-4 w-12"></th>
                <th className="py-4 px-4">Shareholder</th>
                <th className="py-4 px-4">Security Class</th>
                <th className="py-4 px-4 text-right">Total Shares</th>
                <th className="py-4 px-4 text-right">Ownership %</th>
                <th className="py-4 pr-6 pl-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
              {capTableData.map((row) => {
                const isExpanded = expandedRows.includes(row.id);
                return (
                  <React.Fragment key={row.id}>
                    <tr 
                      className={cn(
                        "hover:bg-slate-50/50 transition-colors group cursor-pointer",
                        isExpanded ? "bg-slate-50" : ""
                      )}
                      onClick={() => toggleRow(row.id)}
                    >
                      <td className="py-4 pl-6 pr-4">
                        <button className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900">{row.shareholder}</div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">{row.role}</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-bold",
                          row.securityClass.includes('Preferred') ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"
                        )}>
                          {row.securityClass}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-base font-bold text-slate-700">{row.shares}</td>
                      <td className="py-4 px-4 text-right font-mono font-semibold text-slate-600">{row.ownership}</td>
                      <td className="py-4 pr-6 pl-4 text-center">
                        {row.status === 'confirmed' ? (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide">
                            Confirmed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide">
                            <AlertTriangle className="w-3.5 h-3.5" /> Review Needed
                          </span>
                        )}
                      </td>
                    </tr>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="bg-slate-50 border-b border-slate-100"
                        >
                          <td colSpan={6} className="p-0">
                            <div className="py-6 px-16 flex gap-8">
                              <div className="flex-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                  <Info className="w-4 h-4 text-indigo-500" /> Evidence Trace
                                </h4>
                                <div className="grid grid-cols-3 gap-6">
                                  {row.details.map((detail, idx) => (
                                    <div key={idx}>
                                      <div className="text-xs text-slate-500 mb-1 font-semibold">{detail.label}</div>
                                      <div className="text-sm text-slate-800 font-medium bg-slate-50 p-2 rounded border border-slate-100">{detail.value}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {row.conflict && (
                                <div className="w-1/3 bg-amber-50 p-6 rounded-xl border border-amber-200 shadow-sm flex flex-col justify-center">
                                  <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" /> Unresolved Conflict
                                  </h4>
                                  <p className="text-sm text-amber-800 font-medium leading-relaxed">
                                    {row.conflict}
                                  </p>
                                  <button className="mt-4 bg-amber-100 text-amber-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-amber-200 transition-colors self-start shadow-sm">
                                    Resolve in Review Queue
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100/50 border-t-2 border-slate-200">
              <tr>
                <td colSpan={3} className="py-4 pl-6 pr-4 text-right font-bold text-slate-900 text-sm uppercase tracking-wider">Total Fully Diluted</td>
                <td className="py-4 px-4 text-right font-mono text-lg font-bold text-slate-900">10,000,000</td>
                <td className="py-4 px-4 text-right font-mono font-bold text-slate-900">100.00%</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </motion.div>
  );
}