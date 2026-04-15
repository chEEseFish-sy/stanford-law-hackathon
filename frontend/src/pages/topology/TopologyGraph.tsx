import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import { Download, History, Network, Split, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import { NodeDetailPortal } from "../../components/topology/NodeDetailPortal";
import { useWorkbench } from "../../context/WorkbenchContext";
import { downloadCapTableCsv } from "../../utils/captableExport";
import { cn } from "../../utils/cn";
import { DocumentNode, EventNode, CapTableRowNode } from "./CustomNodes";

const nodeTypes = {
  document: DocumentNode,
  event: EventNode,
  capTableRow: CapTableRowNode,
};

export function TopologyGraph() {
  const {
    snapshot,
    selectedNodeId,
    selectedNodeDetail,
    detailLoading,
    selectNode,
    mergeNode,
    rejectNode,
    archiveNode,
    setViewingVersion,
  } = useWorkbench();
  const [portalNodeId, setPortalNodeId] = useState<string | null>(null);

  const highlightedNodeIds = useMemo(() => {
    const ids = new Set<string>();

    if (selectedNodeId) {
      ids.add(selectedNodeId);
    }

    selectedNodeDetail?.relatedNodes.forEach((node) => ids.add(node.id));
    return ids;
  }, [selectedNodeDetail, selectedNodeId]);

  const nodes = useMemo<Node[]>(() => {
    if (!snapshot) {
      return [];
    }

    return snapshot.topology.nodes.map((node) => {
      const x = node.depth * 320 + 40;
      const y = node.index * 170 + 80;
      const type =
        node.nodeType === "captable_version"
          ? "capTableRow"
          : node.nodeType === "analysis_result"
            ? "event"
            : "document";

      return {
        id: node.id,
        type,
        position: { x, y },
        selected: selectedNodeId === node.id,
        data: {
          label: node.label,
          status: node.status,
          nodeType: node.nodeType,
          entityType: node.entityType,
          meta: `${node.entityType} · depth ${node.depth}`,
          description:
            snapshot.documents.find((document) => document.id === node.entityId)?.summary ??
            snapshot.captableVersions.find((version) => version.id === node.entityId)?.summary ??
            snapshot.structuredResults.find((result) => result.id === node.entityId)?.captableImpactSummary ??
            "Topology node",
          isHighlighted: highlightedNodeIds.has(node.id),
        },
        style: {
          opacity:
            highlightedNodeIds.size === 0 || highlightedNodeIds.has(node.id)
              ? 1
              : 0.45,
        },
      };
    });
  }, [highlightedNodeIds, selectedNodeId, snapshot]);

  const edges = useMemo<Edge[]>(() => {
    if (!snapshot) {
      return [];
    }

    const treeEdges = snapshot.topology.nodes
      .filter((node) => node.parentId)
      .map((node) => ({
        id: `${node.parentId}-${node.id}`,
        source: node.parentId!,
        target: node.id,
        animated: node.status === "processing" || node.status === "draft",
        type: "smoothstep" as const,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
        style: {
          stroke: highlightedNodeIds.size === 0 || (highlightedNodeIds.has(node.id) && highlightedNodeIds.has(node.parentId!))
            ? "#64748b"
            : "#cbd5e1",
          strokeWidth: highlightedNodeIds.has(node.id) ? 2.6 : 1.6,
          opacity:
            highlightedNodeIds.size === 0 || (highlightedNodeIds.has(node.id) && highlightedNodeIds.has(node.parentId!))
              ? 0.95
              : 0.35,
        },
      }));

    const refEdges = snapshot.topology.refs.map((ref) => ({
      id: `${ref.fromNodeId}-${ref.toNodeId}-${ref.refType}`,
      source: ref.fromNodeId,
      target: ref.toNodeId,
      animated: ref.refType === "conflicts_with",
      type: "straight" as const,
      markerEnd: { type: MarkerType.ArrowClosed, color: ref.refType === "conflicts_with" ? "#f59e0b" : "#6366f1" },
      style: {
        stroke: ref.refType === "conflicts_with" ? "#f59e0b" : "#6366f1",
        strokeDasharray: ref.refType === "conflicts_with" ? "5 5" : "3 6",
        strokeWidth: 1.8,
        opacity:
          highlightedNodeIds.size === 0 || (highlightedNodeIds.has(ref.fromNodeId) && highlightedNodeIds.has(ref.toNodeId))
            ? 0.95
            : 0.25,
      },
      label: ref.refType.replace(/_/g, " "),
      labelStyle: {
        fill: "#64748b",
        fontSize: 11,
        fontWeight: 600,
      },
    }));

    return [...treeEdges, ...refEdges];
  }, [highlightedNodeIds, snapshot]);

  const versionNodes = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return snapshot.topology.nodes.filter((node) => node.nodeType === "captable_version");
  }, [snapshot]);
  const captableByNodeId = useMemo(
    () => new Map((snapshot?.captableVersions ?? []).map((version) => [version.topologyNodeId, version])),
    [snapshot],
  );

  const handleNodeClick: NodeMouseHandler = async (_, node) => {
    await selectNode(node.id);
  };

  const handleNodeDoubleClick: NodeMouseHandler = async (_, node) => {
    await selectNode(node.id);
    setPortalNodeId(node.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="grid gap-4 xl:grid-cols-[1.5fr,1fr]">
        <div className="rounded-[28px] border border-white/80 bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-500">
                <Network className="h-4 w-4" />
                Topology control plane
              </div>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                交易文件、草案、Cap Table 版本与分析结果统一进入回溯图
              </h3>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                单击节点高亮相关路径，双击打开详情 Portal。主干、草案、已合并、否决与归档状态均由统一拓扑模型驱动。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Uploads</div>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <UploadCloud className="h-4 w-4 text-indigo-500" />
                  {snapshot?.documents.length ?? 0} files
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Branches</div>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Split className="h-4 w-4 text-violet-500" />
                  {snapshot?.topology.nodes.filter((node) => node.status === "draft").length ?? 0} draft
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">History</div>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <History className="h-4 w-4 text-emerald-500" />
                  {versionNodes.length} versions
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-[28px] border border-white/80 bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Viewing version rail</div>
          <div className="mt-4 flex flex-wrap gap-3">
            {versionNodes.map((node) => {
              const version = captableByNodeId.get(node.id);

              return (
                <div
                  key={node.id}
                  className={cn(
                    "flex overflow-hidden rounded-2xl border text-left transition",
                    snapshot?.topology.currentViewingNodeId === node.id
                      ? "border-indigo-300 bg-indigo-50 text-indigo-950 shadow-sm"
                      : "border-slate-200 bg-slate-50 text-slate-700",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => void setViewingVersion(node.id)}
                    className="px-4 py-3 text-left transition hover:bg-white"
                  >
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{node.status}</div>
                    <div className="mt-2 text-sm font-semibold">{node.label}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => version && snapshot ? downloadCapTableCsv(version, snapshot.documents) : undefined}
                    disabled={!version}
                    className="border-l border-slate-200 px-3 text-slate-500 transition hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Download ${node.label}`}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-15rem)] gap-6">
        <div className="relative flex-1 overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
          <div className="absolute left-5 top-5 z-10 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Topology graph</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">主干 / 分支 / 合并 / 否决 / 回溯</div>
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            className="bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.08),_transparent_18%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]"
          >
            <Background color="#cbd5e1" gap={18} />
            <Controls className="border border-slate-200 bg-white shadow-sm" />
            <MiniMap
              nodeColor={(node) => {
                if (node.type === "capTableRow") {
                  return "#0f172a";
                }

                const status = String(node.data?.status);

                if (status === "draft") return "#8b5cf6";
                if (status === "rejected") return "#f43f5e";
                if (status === "trunk") return "#10b981";
                if (status === "processing") return "#0ea5e9";
                return "#6366f1";
              }}
              className="border border-slate-200 bg-white shadow-sm"
              maskColor="rgba(241,245,249,0.7)"
            />
          </ReactFlow>
        </div>

        <NodeDetailPortal
          detail={portalNodeId ? selectedNodeDetail : null}
          loading={detailLoading}
          documents={snapshot?.documents ?? []}
          onClose={() => setPortalNodeId(null)}
          onMerge={(nodeId) => void mergeNode(nodeId)}
          onReject={(nodeId) => void rejectNode(nodeId)}
          onArchive={(nodeId) => void archiveNode(nodeId)}
          onViewVersion={(nodeId) => void setViewingVersion(nodeId)}
        />
      </div>
    </motion.div>
  );
}
