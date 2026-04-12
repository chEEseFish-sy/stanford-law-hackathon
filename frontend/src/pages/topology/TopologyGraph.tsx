import React, { useState, useCallback, useMemo } from "react";
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  Connection,
  Edge
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { DocumentNode, EventNode, CapTableRowNode } from "./CustomNodes";
import { initialNodes, initialEdges } from "./mockData";
import { motion } from "framer-motion";

const nodeTypes = {
  document: DocumentNode,
  event: EventNode,
  capTableRow: CapTableRowNode,
};

export function TopologyGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    setSelectedNode(node);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-[calc(100vh-8rem)] gap-6"
    >
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm border border-slate-200 font-medium text-sm text-slate-700">
          Evidence Traceability Graph
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-slate-50"
          defaultEdgeOptions={{ 
            animated: true, 
            style: { stroke: '#94a3b8', strokeWidth: 2 }
          }}
        >
          <Background color="#cbd5e1" gap={16} />
          <Controls className="bg-white border-slate-200 shadow-md" />
          <MiniMap 
            nodeColor={(node) => {
              switch (node.type) {
                case 'document': return '#93c5fd';
                case 'event': return '#a5b4fc';
                case 'capTableRow': return '#1e293b';
                default: return '#e2e8f0';
              }
            }}
            className="bg-white border-slate-200 shadow-md"
          />
        </ReactFlow>
      </div>

      {selectedNode && (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-80 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-1 border-b border-slate-100 pb-3">Node Details</h3>
          <div className="mt-4 flex-1">
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Type</label>
              <div className="text-sm font-medium text-slate-700 capitalize">{selectedNode.type.replace(/([A-Z])/g, ' $1').trim()}</div>
            </div>
            
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Label</label>
              <div className="text-base font-semibold text-slate-900">{selectedNode.data.label}</div>
            </div>

            {selectedNode.data.date && (
              <div className="mb-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Date</label>
                <div className="text-sm font-medium text-slate-700">{selectedNode.data.date}</div>
              </div>
            )}

            {selectedNode.data.details && (
              <div className="mb-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Extracted Details</label>
                <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {selectedNode.data.details}
                </div>
              </div>
            )}

            {selectedNode.data.shares && (
              <div className="mb-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Shares</label>
                <div className="text-xl font-mono font-bold text-emerald-600">{selectedNode.data.shares}</div>
              </div>
            )}
          </div>
          
          <button 
            className="w-full mt-4 bg-slate-900 text-white font-medium py-2.5 rounded-lg shadow hover:bg-slate-800 transition-colors duration-200"
            onClick={() => setSelectedNode(null)}
          >
            Close Inspector
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}