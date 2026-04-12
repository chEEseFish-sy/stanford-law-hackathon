import React from "react";
import { motion } from "framer-motion";
import { UploadCloud, FileText, Calendar, Tag, MoreVertical } from "lucide-react";
import { cn } from "../../utils/cn";

export function DocumentIntake() {
  const documents = [
    { id: 1, name: "SAFE_Agreement_Alice.pdf", type: "SAFE", date: "Jan 15, 2023", round: "Pre-seed", status: "processed" },
    { id: 2, name: "SAFE_Agreement_Bob_v2.docx", type: "SAFE", date: "Feb 10, 2023", round: "Pre-seed", status: "processed" },
    { id: 3, name: "Board_Consent_Seed_Round.pdf", type: "Board Consent", date: "Jun 01, 2023", round: "Seed", status: "processed" },
    { id: 4, name: "Stock_Purchase_Agreement_VC.pdf", type: "SPA", date: "Jun 15, 2023", round: "Seed", status: "needs_review" },
    { id: 5, name: "Cap_Table_Draft_vFinal.xlsx", type: "Cap Table", date: "Aug 05, 2023", round: "N/A", status: "processing" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-12 text-center hover:bg-slate-50 hover:border-indigo-400 transition-colors cursor-pointer group">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
          <UploadCloud className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Upload Transaction Documents</h3>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">
          Drag and drop PDF, Word, or Excel files here, or click to browse. We'll automatically extract dates, classify types, and build the evidence trace.
        </p>
        <button className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm hover:shadow">
          Select Files
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Document Organization</h3>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              Filter by Round
            </button>
            <button className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              Filter by Type
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-4 pl-6 pr-4">File Name</th>
                <th className="py-4 px-4">Document Type</th>
                <th className="py-4 px-4">Date</th>
                <th className="py-4 px-4">Round</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 pr-6 pl-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-4 pl-6 pr-4 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <span className="text-slate-900 font-semibold">{doc.name}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-bold">
                      <Tag className="w-3.5 h-3.5 text-slate-400" /> {doc.type}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                      <Calendar className="w-4 h-4 text-slate-400" /> {doc.date}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-slate-600 font-semibold">{doc.round}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide",
                      doc.status === 'processed' ? "bg-emerald-50 text-emerald-700" :
                      doc.status === 'needs_review' ? "bg-amber-50 text-amber-700" :
                      "bg-blue-50 text-blue-700"
                    )}>
                      {doc.status.replace('_', ' ')}
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