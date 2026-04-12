import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "../../utils/cn";

export const DocumentNode = memo(({ data, selected }: NodeProps) => {
  return (
    <div className={cn(
      "px-4 py-3 shadow-lg rounded-xl bg-white border-2 min-w-[220px] transition-all duration-200",
      selected ? "border-indigo-500 ring-4 ring-indigo-100" : "border-slate-200 hover:border-slate-300"
    )}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          data.type === "safe" ? "bg-emerald-100 text-emerald-600" : 
          data.type === "board_consent" ? "bg-amber-100 text-amber-600" : 
          "bg-blue-100 text-blue-600"
        )}>
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-800">{data.label}</div>
          <div className="text-xs text-slate-500 font-medium">{data.date}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </div>
  );
});

export const EventNode = memo(({ data, selected }: NodeProps) => {
  return (
    <div className={cn(
      "px-4 py-3 shadow-lg rounded-xl bg-indigo-50 border-2 min-w-[240px] transition-all duration-200",
      selected ? "border-indigo-600 ring-4 ring-indigo-200" : "border-indigo-200 hover:border-indigo-300"
    )}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-indigo-400" />
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold uppercase tracking-wider text-indigo-500">Event</div>
        {data.status === "confirmed" ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : (
          <AlertCircle className="w-4 h-4 text-amber-500" />
        )}
      </div>
      <div className="text-sm font-semibold text-slate-800">{data.label}</div>
      <div className="text-xs text-slate-600 mt-1">{data.details}</div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-400" />
    </div>
  );
});

export const CapTableRowNode = memo(({ data, selected }: NodeProps) => {
  return (
    <div className={cn(
      "px-4 py-3 shadow-xl rounded-xl bg-slate-800 border-2 min-w-[200px] text-white transition-all duration-200",
      selected ? "border-indigo-400 ring-4 ring-indigo-900" : "border-slate-700 hover:border-slate-600"
    )}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-500" />
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Cap Table Entry</div>
      <div className="text-sm font-bold text-white">{data.label}</div>
      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-700">
        <span className="text-xs text-slate-300">Shares:</span>
        <span className="text-sm font-mono font-bold text-emerald-400">{data.shares}</span>
      </div>
    </div>
  );
});