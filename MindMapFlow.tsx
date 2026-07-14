import { useState, useMemo, useEffect } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeTypes,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Plus,
  Trash2,
  ThumbsUp,
  MessageCircle,
  Pencil,
  User,
  Calendar,
  Maximize2,
  Minimize2,
  Flag,
  AlarmClock,
  Tag,
  MoveHorizontal,
  MoveVertical,
  Building2,
  Eye,
  Copy,
  ClipboardPaste,
  FileText,
  FileSpreadsheet,
  FileImage,
  File as FileIcon,
  ExternalLink,
  Mic,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Circle,
  Clock,
  CircleDot,
  CheckCheck,
  Ban,
  Flame,
  UserCheck,
  MessageSquare,
  X,
  Check,
} from "lucide-react";
import {
  CaseItem,
  TaskNode,
  statusColors,
  statusDot,
  levelColors,
  validityColors,
  urgencyBar,
  currentUser,
  TaskComment,
  ownerToDepartment,
} from "./data";
import { TaskCommentsPanel } from "./TaskCommentsPanel";
import { AddTaskPayload } from "./AddTaskModal";
import { VoiceRecorder, VoicePlayer } from "./VoiceNote";
import { AttachmentInput } from "./AttachmentInput";
import { StatusBadge } from "./StatusBadge";
import { CaseProductPill } from "./CaseProductPill";

type TaskPatch = { likes?: number; likedByMe?: boolean; comments?: TaskComment[] };
type Direction = "LR" | "TB";
type ViewMode = "all" | "incomplete" | "valid";

interface Props {
  caseItem: CaseItem;
  tasks?: TaskNode[];
  focusMine?: boolean;
  showUrgency?: boolean;
  onTaskClick?: (taskId: string) => void;
  onAddChild?: (parentId: string | null, payload: AddTaskPayload) => string | void;
  onEditTask?: (taskId: string, payload: AddTaskPayload) => void;
  onDelete?: (taskId: string) => void;
  onClone?: (sourceId: string, targetParentId: string | null) => void; // 复制/粘贴子树（R29）
  coachGuide?: boolean; // 首次进入的交互式新手引导（仅 case 详情从零搭建时开启）
}

const NODE_TYPES: NodeTypes = {
  caseNode: CaseNodeComponent,
  thoughtNode: ThoughtNodeComponent,
  actionNode: ActionNodeComponent,
  addButtonNode: AddButtonNodeComponent,
};

// ---- tree helpers ----
function walkWithAncestors(
  nodes: TaskNode[],
  ancestors: TaskNode[],
  cb: (node: TaskNode, ancestors: TaskNode[]) => void
) {
  nodes.forEach((n) => {
    cb(n, ancestors);
    if (n.children) walkWithAncestors(n.children, [...ancestors, n], cb);
  });
}
function collectSubtree(node: TaskNode): string[] {
  const out = [node.id];
  (node.children ?? []).forEach((c) => out.push(...collectSubtree(c)));
  return out;
}
function findPath(nodes: TaskNode[], id: string, acc: TaskNode[]): TaskNode[] | null {
  for (const n of nodes) {
    const next = [...acc, n];
    if (n.id === id) return next;
    if (n.children) {
      const r = findPath(n.children, id, next);
      if (r) return r;
    }
  }
  return null;
}
function pruneTree(nodes: TaskNode[], keep: Set<string>): TaskNode[] {
  return nodes
    .filter((n) => keep.has(n.id))
    .map((n) => ({ ...n, children: n.children ? pruneTree(n.children, keep) : n.children }));
}
function findInTree(id: string, list: TaskNode[]): TaskNode | null {
  for (const t of list) {
    if (t.id === id) return t;
    if (t.children) {
      const r = findInTree(id, t.children);
      if (r) return r;
    }
  }
  return null;
}

// ---- R19 folding helpers ----
const ACTIVE_STATUS = new Set(["待开始", "待接受", "进行中"]);
// 子树内是否还有"在跑"的执行任务（待开始/待接受/进行中）
function subtreeHasActive(node: TaskNode): boolean {
  if (node.code && ACTIVE_STATUS.has(node.status)) return true;
  return (node.children ?? []).some(subtreeHasActive);
}
function countDescendants(node: TaskNode): number {
  return (node.children ?? []).reduce((s, c) => s + 1 + countDescendants(c), 0);
}
// 默认折叠：有子节点且整条子树都无在跑任务（已完成/死路）
function defaultCollapsed(roots: TaskNode[]): Set<string> {
  const set = new Set<string>();
  const walk = (nodes: TaskNode[]) => {
    nodes.forEach((n) => {
      const kids = n.children ?? [];
      if (kids.length > 0 && !subtreeHasActive(n)) {
        set.add(n.id); // 折叠在此边界，更深层无需再标（子节点已隐藏）
      } else {
        walk(kids);
      }
    });
  };
  walk(roots);
  return set;
}

// ---- R28 拆分：把"多个怀疑写在一起"的文本拆成多段 ----
function splitSuspicions(text: string): string[] {
  return (text || "")
    .split(/\n+|；|;|（\d+）|\(\d+\)|^\s*\d+[.、)]\s*/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---- 思路模板：因为__原理说明__所以__ ----
const THOUGHT_CATEGORIES = ["设计", "工艺", "测试", "其他"];
const MM_DEPARTMENTS = ["PTE", "CP", "FT", "DA", "PE", "QA", "EFA", "RD", "PM"];
const MM_COACH_KEY = "ea_mm_coach_v1";
function composeThought(parts: [string, string, string]): string {
  const [a, b, c] = parts.map((s) => (s || "").trim());
  if (!a && !b && !c) return "";
  return `因为${a}，原理说明${b}，所以${c}。`;
}
function parseThought(title: string): [string, string, string] {
  if (!title) return ["", "", ""];
  const normalized = title.endsWith("。") ? title.slice(0, -1) : title;
  const m = normalized.match(/^因为([\s\S]*)，原理说明([\s\S]*)，所以([\s\S]*)$/);
  if (m) return [m[1], m[2], m[3]];
  return [title, "", ""];
}


export function MindMapFlow({
  caseItem,
  tasks,
  focusMine = false,
  onTaskClick,
  onAddChild,
  onEditTask,
  onDelete,
  onClone,
  coachGuide = false,
}: Props) {
  const rootTasks = tasks ?? caseItem.tasks;
  const editable = !!(onAddChild && onDelete);

  // view controls
  const [direction, setDirection] = useState<Direction>("LR");
  // 复制/粘贴剪贴板（R29）：存被复制节点 id
  const [clipboard, setClipboard] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("全部"); // R16
  const [deptFilter, setDeptFilter] = useState<string>("全部"); // R16
  const [fullscreen, setFullscreen] = useState(false);

  // interaction state
  const [markedId, setMarkedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // 手动拖拽位置（R18）：覆盖自动布局，会话内保留
  const [manualPos, setManualPos] = useState<Record<string, { x: number; y: number }>>({});
  // 折叠集合（R19）：已完成/死路默认折叠
  const rootTasksForInit = tasks ?? caseItem.tasks;
  const [collapsed, setCollapsed] = useState<Set<string>>(() => defaultCollapsed(rootTasksForInit));
  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // editing state
  const [editingThought, setEditingThought] = useState<string | null>(null);
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [thoughtText, setThoughtText] = useState("");
  const [thoughtCategory, setThoughtCategory] = useState("测试");
  const [actionForm, setActionForm] = useState<any>({});
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [patches, setPatches] = useState<Record<string, TaskPatch>>({});

  // ---- 交互式新手引导 coach（首次进入自动，随实操推进，可跳过；localStorage 记忆）----
  const [coach, setCoach] = useState<{ active: boolean; step: "thought" | "task" | "done" }>(() => {
    try {
      return { active: coachGuide && editable && !localStorage.getItem(MM_COACH_KEY), step: "thought" };
    } catch {
      return { active: false, step: "thought" };
    }
  });
  const closeCoach = () => {
    try { localStorage.setItem(MM_COACH_KEY, "1"); } catch {}
    setCoach((c) => ({ ...c, active: false }));
  };

  const merged = (t: TaskNode): TaskNode => {
    const p = patches[t.id];
    if (!p) return t;
    return {
      ...t,
      likes: p.likes ?? t.likes ?? 0,
      likedByMe: p.likedByMe ?? t.likedByMe ?? false,
      comments: p.comments ?? t.comments ?? [],
    };
  };

  const toggleLike = (id: string) => {
    setPatches((prev) => {
      const cur = prev[id] ?? {};
      const liked = !(cur.likedByMe ?? false);
      const base = cur.likes ?? 0;
      return { ...prev, [id]: { ...cur, likedByMe: liked, likes: base + (liked ? 1 : -1) } };
    });
  };
  const addComment = (id: string, content: string) => {
    setPatches((prev) => {
      const cur = prev[id] ?? {};
      const list = cur.comments ?? [];
      const nc: TaskComment = { id: `c${Date.now()}`, user: currentUser.name, time: "刚刚", content };
      return { ...prev, [id]: { ...cur, comments: [...list, nc] } };
    });
  };
  const replyComment = (taskId: string, commentId: string, content: string) => {
    setPatches((prev) => {
      const cur = prev[taskId] ?? {};
      const list = cur.comments ?? [];
      const nl = list.map((c) =>
        c.id === commentId
          ? { ...c, replies: [...(c.replies ?? []), { id: `r${Date.now()}`, user: currentUser.name, time: "刚刚", content }] }
          : c
      );
      return { ...prev, [taskId]: { ...cur, comments: nl } };
    });
  };

  const toggleMark = (id: string) => setMarkedId((cur) => (cur === id ? null : id));

  // 1) 「只看我的」：高亮而非裁剪——计算我相关节点集合（命中我的任务 + 其路径祖先）
  const showMine = focusMine || onlyMine;
  const mineSet = useMemo(() => {
    if (!showMine) return null;
    const s = new Set<string>();
    walkWithAncestors(rootTasks, [], (node, ancestors) => {
      if (node.owner === currentUser.name) {
        s.add(node.id);
        ancestors.forEach((a) => s.add(a.id));
      }
    });
    return s;
  }, [showMine, rootTasks]);

  // 2) 「只看未完成 / 有效路径」：同样高亮而非裁剪
  const viewSet = useMemo(() => {
    if (viewMode === "all") return null;
    const s = new Set<string>();
    if (viewMode === "incomplete") {
      walkWithAncestors(rootTasks, [], (node, ancestors) => {
        if (node.code && node.status !== "已完成") {
          s.add(node.id);
          ancestors.forEach((a) => s.add(a.id));
        }
      });
    } else {
      walkWithAncestors(rootTasks, [], (node, ancestors) => {
        if (node.validity === "有效") {
          s.add(node.id);
          ancestors.forEach((a) => s.add(a.id));
          collectSubtree(node).forEach((id) => s.add(id));
        }
      });
    }
    return s;
  }, [viewMode, rootTasks]);

  // 高亮集合 = 各启用命名筛选（我的 / 未完成 / 有效路径）的交集；null 表示不启用高亮
  const highlightSet = useMemo(() => {
    const sets = [mineSet, viewSet].filter(Boolean) as Set<string>[];
    if (sets.length === 0) return null;
    return sets.reduce((acc, s) => new Set([...acc].filter((id) => s.has(id))));
  }, [mineSet, viewSet]);

  // 树结构始终完整（不裁剪）；状态/部门下拉仍按原逻辑裁剪（这两项未要求改为高亮）
  const filtered: TaskNode[] = useMemo(() => {
    let base = rootTasks;
    if (statusFilter !== "全部" || deptFilter !== "全部") {
      const keep = new Set<string>();
      walkWithAncestors(base, [], (node, ancestors) => {
        const okStatus = statusFilter === "全部" || (node.code && node.status === statusFilter);
        const okDept = deptFilter === "全部" || node.department === deptFilter;
        if (node.code && okStatus && okDept) {
          keep.add(node.id);
          ancestors.forEach((a) => keep.add(a.id));
        }
      });
      base = pruneTree(base, keep);
    }
    return base;
  }, [rootTasks, statusFilter, deptFilter]);

  // R16：部门选项（取自本 Case 的执行任务）
  const deptOpts = useMemo(() => {
    const s = new Set<string>();
    walkWithAncestors(rootTasks, [], (n) => { if (n.code && n.department) s.add(n.department); });
    return ["全部", ...Array.from(s)];
  }, [rootTasks]);
  const STATUS_OPTS = ["全部", "待开始", "待接受", "进行中", "已完成", "已中止", "已拒绝"];

  // marked lineage (item 9): the whole line of the marked node
  const markedLineage = useMemo(() => {
    if (!markedId) return new Set<string>();
    const path = findPath(rootTasks, markedId, []);
    if (!path) return new Set<string>();
    const set = new Set<string>(path.map((n) => n.id));
    collectSubtree(path[path.length - 1]).forEach((id) => set.add(id));
    return set;
  }, [markedId, rootTasks]);

  // ---- build nodes & edges ----
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    // Tidy tree layout: leaves get evenly spaced cross slots, parents center on
    // their children — guarantees subtrees never overlap.
    const DEPTH_GAP = direction === "LR" ? 390 : 280;
    const LEAF_GAP = direction === "LR" ? 190 : 370;
    const CASE_DEPTH = 0;

    const place = (depthPos: number, crossPos: number) =>
      direction === "LR" ? { x: depthPos, y: crossPos } : { x: crossPos, y: depthPos };

    // Pass 1: assign positions
    const positions: Record<string, { x: number; y: number }> = {};
    let leafCursor = 0;
    const assign = (task: TaskNode, level: number): number => {
      const depthPos = level * DEPTH_GAP;
      const kids = collapsed.has(task.id) ? [] : (task.children ?? []);
      let cross: number;
      if (kids.length === 0) {
        cross = leafCursor * LEAF_GAP;
        leafCursor += 1;
      } else {
        const cs = kids.map((k) => assign(k, level + 1));
        cross = (cs[0] + cs[cs.length - 1]) / 2;
      }
      positions[task.id] = place(depthPos, cross);
      return cross;
    };
    filtered.forEach((r) => assign(r, 1));
    const caseCross = leafCursor > 0 ? ((leafCursor - 1) * LEAF_GAP) / 2 : 0;

    // 卡片悬停或进入编辑态后会向下变高：把其下方节点整体推开，避免覆盖和连线挤成一团。
    // 编辑态优先于 hover；手动拖拽位置也参与推开计算。
    const expandedId = editingAction || editingThought || hoveredId;
    const expandedPos = expandedId
      ? (manualPos[expandedId] ?? positions[expandedId])
      : undefined;
    const expandedTask = expandedId ? findInTree(expandedId, filtered) : null;
    const expandedPath = expandedId ? findPath(filtered, expandedId, []) : null;
    const frozenIds = new Set<string>(["case"]);
    expandedPath?.slice(0, -1).forEach((n) => frozenIds.add(n.id));
    const PUSH = editingAction
      ? 430
      : editingThought
      ? 230
      : expandedPos
      ? (expandedTask?.code ? 240 : 120)
      : 0;
    const pushDown = (id: string, p: { x: number; y: number }) =>
      expandedPos && id !== expandedId && p.y > expandedPos.y
        ? { x: p.x, y: p.y + PUSH }
        : p;
    const placeNode = (id: string, p: { x: number; y: number }) =>
      frozenIds.has(id) ? p : pushDown(id, p);

    nodes.push({
      id: "case",
      type: "caseNode",
      position: place(CASE_DEPTH, caseCross), // 根节点始终不随 hover 推移
      data: { caseItem, direction },
    });

    // Pass 2: build nodes + edges
    const build = (list: TaskNode[], parentId: string) => {
      list.forEach((task) => {
        const nodeId = task.id;
        const isThought = !task.code;

        const onLine = markedLineage.has(nodeId);
        // 标记整条线时弱化其余；命名筛选（我的/未完成/有效路径）启用时，弱化未命中节点——树结构保留
        const dimmed = (!!markedId && !onLine) || (!!highlightSet && !highlightSet.has(nodeId));

        nodes.push({
          id: nodeId,
          type: isThought ? "thoughtNode" : "actionNode",
          position: placeNode(nodeId, manualPos[nodeId] ?? positions[nodeId]),
          zIndex: expandedId === nodeId ? 1000 : onLine ? 6 : 1,
          data: {
            task: merged(task),
            direction,
            editable,
            onTaskClick,
            onDelete,
            onToggleLike: toggleLike,
            onOpenComments: setOpenComments,
            onToggleMark: toggleMark,
            onHover: setHoveredId,
            marked: onLine,
            isMarkRoot: markedId === nodeId,
            dimmed,
            isEditing: isThought ? editingThought === nodeId : editingAction === nodeId,
            onEdit: isThought
              ? () => {
                  setThoughtText(task.title);
                  setThoughtCategory(task.category || "测试");
                  setEditingThought(nodeId);
                }
              : () => {
                  setActionForm({
                    title: task.title,
                    expectation: task.expectation || "",
                    urgency: task.urgency,
                    department: task.department,
                    assignee: task.owner === "待指派" ? "" : task.owner,
                    dueDate: task.dueDate || "",
                    voiceNote: task.voiceNote,
                    attachments: task.attachments || [],
                  });
                  setEditingAction(nodeId);
                },
            onSave: isThought
              ? () => {
                  onEditTask?.(nodeId, {
                    kind: "怀疑目标",
                    title: thoughtText,
                    category: thoughtCategory,
                    department: "PTE",
                    urgency: "一般",
                    assignee: "",
                    dueDate: "",
                    type: undefined,
                    note: "",
                    supervisor: "",
                    site: undefined,
                  });
                  setEditingThought(null);
                  if (thoughtText.trim()) {
                    setCoach((c) => (c.active && c.step === "thought" ? { ...c, step: "task" } : c));
                  }
                }
              : () => {
                  onEditTask?.(nodeId, {
                    kind: "执行任务",
                    title: actionForm.title,
                    expectation: actionForm.expectation,
                    department: actionForm.department,
                    urgency: actionForm.urgency,
                    assignee: actionForm.assignee,
                    dueDate: actionForm.dueDate,
                    type: undefined,
                    voiceNote: actionForm.voiceNote,
                    attachments: actionForm.attachments,
                    supervisor: "",
                    site: undefined,
                  });
                  setEditingAction(null);
                  if (actionForm.title?.trim()) {
                    setCoach((c) => (c.active && c.step === "task" ? { ...c, step: "done" } : c));
                  }
                },
            onCancel: isThought ? () => setEditingThought(null) : () => setEditingAction(null),
            thoughtText: isThought ? thoughtText : undefined,
            setThoughtText: isThought ? setThoughtText : undefined,
            thoughtCategory: isThought ? thoughtCategory : undefined,
            setThoughtCategory: isThought ? setThoughtCategory : undefined,
            actionForm: !isThought ? actionForm : undefined,
            setActionForm: !isThought ? setActionForm : undefined,
            onAddChild: isThought
              ? () =>
                  onAddChild?.(nodeId, {
                    kind: "执行任务", title: "执行任务", department: "PTE", urgency: "一般",
                    assignee: "", dueDate: "", type: undefined, note: "", supervisor: "", site: undefined,
                  })
              : () => {
                  // 新建子思路后直接进入编辑态（免再点一次「编辑」）
                  const newId = onAddChild?.(nodeId, {
                    kind: "怀疑目标", title: "新的思路/怀疑方向", category: "测试", department: "PTE", urgency: "一般",
                    assignee: "", dueDate: "", type: undefined, note: "", supervisor: "", site: undefined,
                  });
                  if (newId) { setThoughtText(""); setThoughtCategory("测试"); setEditingThought(newId); }
                },
            // 折叠（R19）
            hasChildren: !!(task.children && task.children.length),
            collapsed: collapsed.has(nodeId),
            collapsedCount: countDescendants(task),
            onToggleCollapse: () => toggleCollapse(nodeId),
            // 复制/粘贴（R29）
            isCopied: clipboard === nodeId,
            onCopy: onClone ? () => setClipboard(nodeId) : undefined,
            onPaste: onClone && clipboard ? () => { onClone(clipboard, nodeId); setClipboard(null); } : undefined,
            // 拆分多个怀疑方向（R28）
            onSplit: isThought
              ? (segments: string[]) => {
                  if (!segments.length) return;
                  onEditTask?.(nodeId, {
                    kind: "怀疑目标", title: segments[0], category: thoughtCategory,
                    department: "PTE", urgency: "一般", assignee: "", dueDate: "",
                    type: undefined, note: "", supervisor: "", site: undefined,
                  });
                  segments.slice(1).forEach((s) =>
                    onAddChild?.(parentId === "case" ? null : parentId, {
                      kind: "怀疑目标", title: s, department: "PTE", urgency: "一般",
                      assignee: "", dueDate: "", type: undefined, note: "", supervisor: "", site: undefined,
                    })
                  );
                  setEditingThought(null);
                }
              : undefined,
          },
        });

        const edgeOnLine = markedLineage.has(parentId) && onLine;
        edges.push({
          id: `${parentId}-${nodeId}`,
          source: parentId,
          target: nodeId,
          type: "smoothstep",
          animated: edgeOnLine,
          zIndex: edgeOnLine ? 5 : 0,
          pathOptions: {
            borderRadius: 10,
            // 同一父节点共用一条主干，再向各子节点分叉，避免平行线重叠成线束
            offset: 28,
          },
          style: {
            stroke: edgeOnLine ? "#7c3aed" : markedId ? "#e2e8f0" : "#cbd5e1",
            strokeWidth: edgeOnLine ? 2.5 : 2,
          },
        });

        if (task.children && task.children.length > 0 && !collapsed.has(nodeId)) {
          build(task.children, nodeId);
        }
      });
    };

    build(filtered, "case");

    if (editable) {
      const addCross = leafCursor * LEAF_GAP;
      nodes.push({
        id: "add-thought-btn",
        type: "addButtonNode",
        position: pushDown("add-thought-btn", place(DEPTH_GAP, addCross)),
        data: {
          direction,
          guideHighlight: coach.active && coach.step === "thought",
          onClick: () => {
            // 新建根思路后直接进入编辑态（免再点一次「编辑」）
            const newId = onAddChild?.(null, {
              kind: "怀疑目标", title: "新的思路/怀疑方向", category: "测试", department: "PTE", urgency: "一般",
              assignee: "", dueDate: "", type: undefined, note: "", supervisor: "", site: undefined,
            });
            if (newId) { setThoughtText(""); setThoughtCategory("测试"); setEditingThought(newId); }
          },
        },
      });
    }

    return { nodes, edges };
  }, [
    filtered, highlightSet, caseItem, editable, direction, markedId, markedLineage, hoveredId, manualPos, collapsed, clipboard,
    editingThought, editingAction, thoughtText, thoughtCategory, actionForm, patches,
    coach,
  ]);

  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges] = useEdgesState(edges);
  useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);

  const commentTarget = openComments ? findInTree(openComments, filtered) : null;
  const commentTargetMerged = commentTarget ? merged(commentTarget) : null;

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 bg-gradient-to-br from-slate-50 to-white"
          : "relative bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-lg overflow-hidden"
      }
    >
      {/* 交互式新手引导 coach：随实操推进（填思路 → 挂任务 → 完成） */}
      {coach.active && (
        <div className="fixed bottom-6 right-6 z-[60] w-[288px] max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-100">
          <div className="overflow-hidden rounded-2xl">
          <div
            className={`px-4 pt-3.5 pb-3 text-white bg-gradient-to-br ${
              coach.step === "thought"
                ? "from-amber-500 to-orange-500"
                : coach.step === "task"
                ? "from-[#0052D9] to-[#00A4FF]"
                : "from-emerald-500 to-teal-500"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium tracking-wide opacity-90">
                {coach.step === "done" ? "🎉 已完成" : `第 ${coach.step === "thought" ? 1 : 2} / 2 步`}
              </div>
              {coach.step !== "done" && (
                <button onClick={closeCoach} title="跳过引导" className="w-6 h-6 rounded-md bg-white/15 hover:bg-white/25 flex items-center justify-center">
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="mt-1 text-[15px] font-bold leading-snug">
              {coach.step === "thought" && "写下你的第一个怀疑方向"}
              {coach.step === "task" && "给思路挂一个执行任务"}
              {coach.step === "done" && "第一条排查线已建好！"}
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="text-[12.5px] text-slate-600 leading-relaxed">
              {coach.step === "thought" &&
                "点画布上高亮的「＋ 新建思路」，用「因为 / 原理说明 / 所以」写下一个怀疑方向，然后点确认。"}
              {coach.step === "task" &&
                "把鼠标移到刚建好的思路卡上，点右上角蓝色 ＋，添加并填写一个执行任务（名称 / 负责人 / 部门 / 时间）。"}
              {coach.step === "done" &&
                "你已经建好「思路 → 执行任务」。之后用同样的方式：hover 卡片点 ＋，继续扩展怀疑树，把根因一层层查清。"}
            </p>
            {coach.step === "done" ? (
              <button
                onClick={closeCoach}
                className="mt-3 w-full h-8 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[12.5px] font-medium inline-flex items-center justify-center gap-1.5 hover:shadow-md"
              >
                <Check size={14} /> 完成
              </button>
            ) : (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">👆 请按提示操作，自动进入下一步</span>
                <button onClick={closeCoach} className="text-[11px] text-slate-400 hover:text-slate-600">跳过</button>
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 flex-wrap">
        {/* View filter (item 11) */}
        <div className="inline-flex items-center bg-white/95 border border-slate-200 rounded-lg p-0.5 shadow-sm">
          {([
            { k: "all", label: "全局视图", icon: Eye },
            { k: "incomplete", label: "只看未完成", icon: AlarmClock },
            { k: "valid", label: "只看有效路径", icon: Flag },
          ] as { k: ViewMode; label: string; icon: any }[]).map(({ k, label, icon: Icon }) => (
            <button
              key={k}
              onClick={() => setViewMode(k)}
              className={`h-7 px-2.5 rounded-md text-xs inline-flex items-center gap-1 transition-all ${
                viewMode === k ? "bg-[#0052D9] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
          {/* 只看我的：并入同一档位组（与视图档位独立，可叠加） */}
          <span className="w-px h-4 bg-slate-200 mx-0.5" />
          <button
            onClick={() => setOnlyMine((v) => !v)}
            title="只看我负责的任务（可与视图档位叠加）"
            className={`h-7 px-2.5 rounded-md text-xs inline-flex items-center gap-1 transition-all ${
              onlyMine ? "bg-[#0052D9] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <User size={12} /> 只看我的
          </button>
        </div>
        {/* R16：按状态 / 部门筛选 */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          title="按任务状态筛选"
          className={`h-8 px-2 rounded-lg border shadow-sm text-xs outline-none cursor-pointer ${
            statusFilter === "全部" ? "bg-white/95 border-slate-200 text-slate-600" : "bg-[#0052D9] text-white border-[#0052D9]"
          }`}
        >
          {STATUS_OPTS.map((s) => <option key={s} value={s} className="text-slate-700">{s === "全部" ? "状态：全部" : s}</option>)}
        </select>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          title="按部门筛选"
          className={`h-8 px-2 rounded-lg border shadow-sm text-xs outline-none cursor-pointer ${
            deptFilter === "全部" ? "bg-white/95 border-slate-200 text-slate-600" : "bg-[#0052D9] text-white border-[#0052D9]"
          }`}
        >
          {deptOpts.map((d) => <option key={d} value={d} className="text-slate-700">{d === "全部" ? "部门：全部" : d}</option>)}
        </select>
        {/* Layout direction (item 8) */}
        <button
          onClick={() => setDirection((d) => (d === "LR" ? "TB" : "LR"))}
          title={direction === "LR" ? "切换为竖向布局" : "切换为横向布局"}
          className="h-8 px-2.5 rounded-lg bg-white/95 border border-slate-200 shadow-sm text-xs text-slate-600 hover:text-[#0052D9] inline-flex items-center gap-1"
        >
          {direction === "LR" ? <MoveVertical size={13} /> : <MoveHorizontal size={13} />}
          {direction === "LR" ? "竖向" : "横向"}
        </button>
        {/* 折叠/展开已完成·死路（R19） */}
        <button
          onClick={() => setCollapsed((prev) => (prev.size ? new Set() : defaultCollapsed(filtered)))}
          title="折叠已完成/死路 或 全部展开"
          className="h-8 px-2.5 rounded-lg bg-white/95 border border-slate-200 shadow-sm text-xs text-slate-600 hover:text-[#0052D9] inline-flex items-center gap-1"
        >
          {collapsed.size ? "展开全部" : "折叠已完成"}
        </button>
        {/* 重新布局：清除手动拖拽位置（R18） */}
        {Object.keys(manualPos).length > 0 && (
          <button
            onClick={() => setManualPos({})}
            title="清除手动拖拽，恢复自动布局"
            className="h-8 px-2.5 rounded-lg bg-white/95 border border-slate-200 shadow-sm text-xs text-slate-600 hover:text-[#0052D9] inline-flex items-center gap-1"
          >
            <Eye size={13} /> 重新布局
          </button>
        )}
      </div>

      <button
        onClick={() => setFullscreen((v) => !v)}
        title={fullscreen ? "退出全屏" : "全屏"}
        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-md bg-white/90 border border-slate-200 shadow-sm hover:bg-white flex items-center justify-center text-slate-600 hover:text-[#0052D9]"
      >
        {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>

      <div className={fullscreen ? "h-full w-full" : "h-[600px] w-full"}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onNodeDragStop={(_, node) =>
            setManualPos((p) => ({ ...p, [node.id]: { x: node.position.x, y: node.position.y } }))
          }
          fitView
          minZoom={0.4}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
          <MiniMap
            zoomable
            pannable
            nodeColor={(node) => {
              if (node.type === "caseNode") return "#334155";
              if (node.type === "thoughtNode") return "#F59E0B";
              if (node.type === "actionNode") return "#0052D9";
              return "#CBD5E1";
            }}
          />
        </ReactFlow>
      </div>

      {commentTargetMerged && (
        <TaskCommentsPanel
          taskTitle={commentTargetMerged.title}
          comments={commentTargetMerged.comments ?? []}
          likes={commentTargetMerged.likes ?? 0}
          likedByMe={commentTargetMerged.likedByMe ?? false}
          onAddComment={(c) => addComment(commentTargetMerged.id, c)}
          onReply={(cid, c) => replyComment(commentTargetMerged.id, cid, c)}
          onToggleLike={() => toggleLike(commentTargetMerged.id)}
          onClose={() => setOpenComments(null)}
        />
      )}

      {/* legend —— 精简：仅紧急度色条对照 */}
      <div className="absolute bottom-3.5 left-[58px] px-3 py-1.5 text-[11px] text-slate-500 bg-white/95 border border-slate-200 rounded-lg shadow-sm flex items-center gap-2.5">
        {showMine && <span className="text-[#0052D9] font-medium">已聚焦我的</span>}
        <span className="text-slate-400">紧急度</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-0.5 h-3 bg-red-400" />非常紧急</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-0.5 h-3 bg-orange-400" />紧急</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-0.5 h-3 bg-sky-400" />一般</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-0.5 h-3 bg-slate-300" />不紧急</span>
      </div>
    </div>
  );
}

// ---- Case Node ----
function CaseNodeComponent({ data }: { data: any }) {
  const { caseItem, direction } = data;
  return (
    <div className="group/case relative bg-white border-2 border-slate-200 rounded-xl p-4 shadow-lg w-[280px] transition-shadow hover:shadow-xl">
      <Handle type="source" position={direction === "LR" ? Position.Right : Position.Bottom} />
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1">
          <div className={`px-2 py-0.5 rounded text-xs border ${levelColors[caseItem.level]}`}>{caseItem.level}</div>
          <CaseProductPill caseItem={caseItem} compact />
        </div>
        <div className="text-xs text-slate-400 font-mono">{caseItem.code}</div>
      </div>
      <h4 className="text-sm font-medium text-slate-900 leading-snug mb-2 line-clamp-2">{caseItem.name}</h4>
      <div className="space-y-1.5 text-xs text-slate-500">
        <div className="flex items-center gap-1.5"><User size={12} /><span>Owner: {caseItem.owner}</span></div>
        <div className="flex items-center gap-1.5"><Building2 size={12} /><span>{caseItem.departments?.length || 0} 部门</span></div>
      </div>

      {/* Hover 查看 Case 背景 / 影响（#3） */}
      <div className="max-h-0 opacity-0 group-hover/case:max-h-[260px] group-hover/case:opacity-100 overflow-hidden transition-all duration-200">
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
          <div>
            <div className="text-[10px] text-slate-400 mb-0.5">背景（What &amp; Why）</div>
            <div className="text-[11px] text-slate-600 leading-relaxed line-clamp-4">{caseItem.background || "—"}</div>
          </div>
          {caseItem.impact && (
            <div>
              <div className="text-[10px] text-slate-400 mb-0.5">影响</div>
              <div className="text-[11px] text-slate-600 leading-relaxed line-clamp-3">{caseItem.impact}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- small reusable card toolbar button ----
function MiniBtn({
  onClick, title, active, activeClass, children,
}: { onClick: (e: any) => void; title: string; active?: boolean; activeClass?: string; children: any }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
        active ? activeClass : "text-slate-500 hover:bg-slate-900/[0.06] hover:text-[#0052D9]"
      }`}
    >
      {children}
    </button>
  );
}

// 任务数据/附件的类型小图标
function AttIcon({ kind }: { kind: "pdf" | "image" | "sheet" | "file" }) {
  if (kind === "pdf") return <FileText size={12} className="text-rose-500" />;
  if (kind === "image") return <FileImage size={12} className="text-sky-500" />;
  if (kind === "sheet") return <FileSpreadsheet size={12} className="text-emerald-500" />;
  return <FileIcon size={12} className="text-slate-400" />;
}

// 结论有效性图标
function ValidityIcon({ v }: { v: string }) {
  if (v === "有效") return <CheckCircle2 size={12} className="text-emerald-600" />;
  if (v === "部分有效") return <AlertTriangle size={12} className="text-amber-600" />;
  return <XCircle size={12} className="text-slate-400" />; // 无效：中性灰，不用红（避让紧急度）
}

// 任务状态图标 —— 方案 B：实心圆形徽章（同色柔底 + 同色图标）
const STATUS_BADGE: Record<string, string> = {
  待开始: "bg-slate-100 text-slate-500",
  待接受: "bg-amber-100 text-amber-600",
  进行中: "bg-blue-100 text-blue-600",
  已完成: "bg-emerald-100 text-emerald-600",
  已中止: "bg-slate-100 text-slate-500",
  已拒绝: "bg-rose-100 text-rose-600",
};
function StatusIcon({ s }: { s: string }) {
  const Icon =
    s === "待接受" ? Clock :
    s === "进行中" ? CircleDot :
    s === "已完成" ? CheckCheck :
    s === "已中止" ? Ban :
    s === "已拒绝" ? XCircle : Circle;
  return (
    <span className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-full ${STATUS_BADGE[s] || "bg-slate-100 text-slate-500"}`}>
      <Icon size={11} strokeWidth={2.4} />
    </span>
  );
}

// ---- Thought Node (思路/怀疑方向) ----
function ThoughtNodeComponent({ data }: { data: any }) {
  const {
    task, direction, editable, onEdit, onSave, onCancel, onDelete, isEditing,
    thoughtText, setThoughtText, thoughtCategory, setThoughtCategory,
    onToggleLike, onOpenComments, onAddChild, onToggleMark,
    marked, isMarkRoot, dimmed, onHover,
    hasChildren, collapsed, collapsedCount, onToggleCollapse, onSplit,
    isCopied, onCopy, onPaste,
  } = data;
  const isThoughtEmpty = !task.title?.trim() || task.title === "新的思路/怀疑方向";
  const isOtherCategory = thoughtCategory === "其他";
  const thoughtParts = isEditing ? parseThought(thoughtText) : ["", "", ""];
  const thoughtSaveable = isOtherCategory
    ? !!thoughtText.trim()
    : !!(thoughtParts[0].trim() && thoughtParts[2].trim());
  const setThoughtPart = (idx: number, v: string) => {
    const next = [...thoughtParts] as [string, string, string];
    next[idx] = v;
    setThoughtText?.(composeThought(next));
  };

  const ring = isMarkRoot
    ? "!border-violet-500 border-2 ring-2 ring-violet-300/50"
    : marked
    ? "!border-violet-300 border-2"
    : "border border-amber-300";

  return (
    <div
      className={`relative w-[320px] transition-all ${dimmed ? "opacity-40" : ""}`}
      onMouseEnter={() => onHover?.(task.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <Handle type="target" position={direction === "LR" ? Position.Left : Position.Top} />
      <Handle type="source" position={direction === "LR" ? Position.Right : Position.Bottom} />

      {/* 折叠/展开按钮放卡片右侧外部（修改点 1） */}
      {!isEditing && hasChildren && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse?.(); }}
          title={collapsed ? `展开 ${collapsedCount} 个子节点` : "折叠子节点"}
          className="absolute top-1/2 -right-3 -translate-y-1/2 z-30 h-6 min-w-6 px-1.5 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[10px] tabular-nums text-slate-500 hover:text-[#0052D9] hover:border-[#0052D9]/40 transition-colors"
        >
          {collapsed ? `+${collapsedCount}` : "－"}
        </button>
      )}

      <div className={`relative bg-amber-50/60 rounded-xl p-3.5 group/thought transition-all duration-200 hover:scale-[1.03] hover:shadow-md ${ring}`}>
        {!isEditing ? (
          <>
            {editable && (
              <div className="absolute top-2 right-2 z-20 flex items-center gap-0.5 opacity-0 group-hover/thought:opacity-100 transition-opacity">
                <MiniBtn onClick={onEdit} title="编辑"><Pencil size={12} /></MiniBtn>
                <MiniBtn onClick={(e) => { e.stopPropagation(); onToggleMark?.(task.id); }} title="标记整条线" active={isMarkRoot} activeClass="bg-violet-500 text-white"><Flag size={12} /></MiniBtn>
                {onCopy && <MiniBtn onClick={(e) => { e.stopPropagation(); onCopy(); }} title="复制此节点及子树" active={isCopied} activeClass="bg-[#0052D9] text-white"><Copy size={12} /></MiniBtn>}
                {onPaste && <MiniBtn onClick={(e) => { e.stopPropagation(); onPaste(); }} title="粘贴为子节点"><ClipboardPaste size={12} /></MiniBtn>}
                <MiniBtn onClick={() => { if (confirm(`删除思路「${task.title}」及其所有执行任务？`)) onDelete?.(task.id); }} title="删除"><Trash2 size={12} /></MiniBtn>
                <button
                  onClick={(e) => { e.stopPropagation(); onAddChild?.(); }}
                  title="添加执行任务"
                  className="w-6 h-6 rounded-full bg-[#0052D9] text-white shadow-sm flex items-center justify-center hover:bg-[#003FA8]"
                >
                  <Plus size={13} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[11px] text-amber-700 font-medium tracking-wide shrink-0">思路 / 怀疑方向</span>
              {task.category && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 border border-amber-200 shrink-0 whitespace-nowrap">
                  <Tag size={9} /> {task.category}
                </span>
              )}
            </div>

            {/* R24：未填写时显示撰写引导，填写后隐藏 */}
            {isThoughtEmpty ? (
              <button
                onClick={onEdit}
                className="text-left w-full text-[12px] text-amber-600/70 italic leading-relaxed hover:text-amber-700"
              >
                点此填写：怀疑什么 + 为什么怀疑（一个方向写一个节点）
              </button>
            ) : (
              <p className="text-[13px] text-slate-800 leading-relaxed font-medium">{task.title}</p>
            )}

            {/* full info on hover */}
            <div className="max-h-0 opacity-0 group-hover/thought:max-h-[160px] group-hover/thought:opacity-100 overflow-hidden transition-all duration-200">
              <div className="pt-2 mt-2 border-t border-amber-200/60 flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleLike?.(task.id); }}
                  className={`h-5 px-1.5 text-[10px] rounded inline-flex items-center gap-0.5 ${
                    task.likedByMe ? "bg-amber-100 text-amber-700" : "text-slate-500 hover:bg-amber-50"
                  }`}
                >
                  <ThumbsUp size={10} /> {task.likes || 0}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenComments?.(task.id); }}
                  className="h-5 px-1.5 text-[10px] rounded inline-flex items-center gap-0.5 text-slate-500 hover:bg-amber-50"
                >
                  <MessageCircle size={10} /> {(task.comments || []).length}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-xs text-amber-700 font-medium">编辑思路 / 怀疑方向</div>
              <select
                value={thoughtCategory || "测试"}
                onChange={(e) => setThoughtCategory?.(e.target.value)}
                className="h-6 rounded-full border px-2 text-[11px] outline-none border-amber-300 text-amber-700 bg-amber-50"
              >
                {THOUGHT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {isOtherCategory ? (
              <div>
                <div className="text-[11px] font-semibold text-slate-600 mb-1">工作思路 <span className="text-red-500">*</span></div>
                <textarea
                  value={thoughtText}
                  onChange={(e) => setThoughtText?.(e.target.value)}
                  placeholder="请填写工作思路"
                  autoFocus
                  className="w-full min-h-[88px] p-2 rounded border border-slate-200 bg-white text-[12.5px] leading-relaxed outline-none focus:border-amber-500 resize-y"
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-600 mb-1">
                      因为 <span className="text-red-500">*</span>
                    </div>
                    <input
                      value={thoughtParts[0]}
                      onChange={(e) => setThoughtPart(0, e.target.value)}
                      placeholder="看到什么失效现象，关联以往什么 case"
                      autoFocus
                      className="w-full h-8 px-2 rounded border border-slate-200 bg-white text-[12.5px] outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-600 mb-1 inline-flex items-center gap-1.5">
                      原理说明 <span className="text-[10px] font-normal text-slate-400 border border-slate-200 rounded-full px-1.5 leading-4">选填</span>
                    </div>
                    <input
                      value={thoughtParts[1]}
                      onChange={(e) => setThoughtPart(1, e.target.value)}
                      placeholder="补充原理内容，可增加Case评分"
                      className="w-full h-8 px-2 rounded border border-dashed border-slate-300 bg-slate-50 text-[12.5px] outline-none focus:border-slate-400 focus:bg-white"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-600 mb-1">
                      所以 <span className="text-red-500">*</span>
                    </div>
                    <input
                      value={thoughtParts[2]}
                      onChange={(e) => setThoughtPart(2, e.target.value)}
                      placeholder="怀疑和什么有关"
                      className="w-full h-8 px-2 rounded border border-slate-200 bg-white text-[12.5px] outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                <div className="mt-1.5 text-[10px] text-amber-600/80">「因为」和「所以」必填，原理说明选填</div>
              </>
            )}
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={onSave}
                disabled={!thoughtSaveable}
                className={`flex-1 h-7 rounded text-white text-xs ${thoughtSaveable ? "bg-[#0052D9] hover:bg-[#003FA8]" : "bg-slate-300 cursor-not-allowed"}`}
              >
                确认
              </button>
              <button onClick={onCancel} className="flex-1 h-7 rounded border border-slate-200 text-slate-600 text-xs hover:bg-slate-50">取消</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---- Action Node (执行任务) — small by default, expands on hover ----
function ActionNodeComponent({ data }: { data: any }) {
  const {
    task, direction, editable, onEdit, onSave, onCancel, onDelete, isEditing,
    actionForm, setActionForm, onTaskClick, onToggleLike, onOpenComments, onAddChild,
    marked, isMarkRoot, dimmed,
    onToggleMark, onHover,
    hasChildren, collapsed, collapsedCount, onToggleCollapse,
    isCopied, onCopy, onPaste,
  } = data;

  const baseBg = "bg-white";
  const ring = isMarkRoot
    ? "!border-violet-500 border-2 ring-2 ring-violet-300/50"
    : marked
    ? "!border-violet-300 border-2"
    : "border border-slate-200";

  if (isEditing) {
    return (
      <div className="relative w-[280px] z-50">
        <Handle type="target" position={direction === "LR" ? Position.Left : Position.Top} />
        <Handle type="source" position={direction === "LR" ? Position.Right : Position.Bottom} />
        <div className="bg-white border-2 border-[#0052D9] rounded-xl p-3.5 shadow-xl space-y-2.5 max-h-[78vh] overflow-y-auto">
          <div>
            <label className="text-xs text-slate-500 block mb-1">任务名称</label>
            <input
              value={actionForm?.title || ""}
              onChange={(e) => setActionForm?.({ ...actionForm, title: e.target.value })}
              placeholder="符合预期怎么做 + 不符合怎么做"
              className="w-full h-8 px-2 text-sm border border-slate-200 rounded outline-none focus:border-[#0052D9]"
            />
            <div className="mt-1 text-[10px] text-slate-400">建议：执行任务名称 = 符合预期怎么做 + 不符合怎么做</div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">预期</label>
            <input
              value={actionForm?.expectation || ""}
              onChange={(e) => setActionForm?.({ ...actionForm, expectation: e.target.value })}
              placeholder="预期"
              className="w-full h-8 px-2 text-sm border border-slate-200 rounded outline-none focus:border-[#0052D9]"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-1">紧急程度</label>
              <select
                value={actionForm?.urgency || "一般"}
                onChange={(e) => setActionForm?.({ ...actionForm, urgency: e.target.value })}
                className="w-full h-8 px-2 text-sm border border-slate-200 rounded outline-none focus:border-[#0052D9]"
              >
                <option value="非常紧急">非常紧急</option>
                <option value="紧急">紧急</option>
                <option value="一般">一般</option>
                <option value="不紧急">不紧急</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-1">期望完成时间</label>
              <input
                type="date"
                value={actionForm?.dueDate || ""}
                onChange={(e) => setActionForm?.({ ...actionForm, dueDate: e.target.value })}
                className="w-full h-8 px-2 text-sm border border-slate-200 rounded outline-none focus:border-[#0052D9]"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-1">负责人</label>
              <input
                value={actionForm?.assignee || ""}
                onChange={(e) => {
                  const a = e.target.value;
                  const dept = ownerToDepartment[a] || actionForm?.department || "PTE";
                  setActionForm?.({ ...actionForm, assignee: a, department: dept });
                }}
                placeholder="负责人"
                className="w-full h-8 px-2 text-sm border border-slate-200 rounded outline-none focus:border-[#0052D9]"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-1">分派部门</label>
              <select
                value={actionForm?.department || "PTE"}
                onChange={(e) => setActionForm?.({ ...actionForm, department: e.target.value })}
                className="w-full h-8 px-2 text-sm border border-slate-200 rounded outline-none focus:border-[#0052D9]"
              >
                {MM_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label className="text-xs text-slate-500 block mb-1">附件</label>
              <AttachmentInput
                value={actionForm?.attachments || []}
                onChange={(next) => setActionForm?.({ ...actionForm, attachments: next })}
                compact
              />
            </div>
            <div className="min-w-0">
              <label className="text-xs text-slate-500 block mb-1">语音备注</label>
              <VoiceRecorder
                value={actionForm?.voiceNote}
                onChange={(v) => setActionForm?.({ ...actionForm, voiceNote: v })}
                compact
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onSave} className="flex-1 h-7 rounded bg-[#0052D9] text-white text-xs hover:bg-[#003FA8]">确认</button>
            <button onClick={onCancel} className="flex-1 h-7 rounded border border-slate-200 text-slate-600 text-xs hover:bg-slate-50">取消</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative w-[256px] transition-opacity ${dimmed ? "opacity-40" : ""}`}
      onMouseEnter={() => onHover?.(task.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <Handle type="target" position={direction === "LR" ? Position.Left : Position.Top} />
      <Handle type="source" position={direction === "LR" ? Position.Right : Position.Bottom} />

      {/* 折叠/展开按钮放卡片右侧外部（修改点 1） */}
      {hasChildren && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse?.(); }}
          title={collapsed ? `展开 ${collapsedCount} 个子节点` : "折叠子节点"}
          className="absolute top-1/2 -right-3 -translate-y-1/2 z-30 h-6 min-w-6 px-1.5 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[10px] tabular-nums text-slate-500 hover:text-[#0052D9] hover:border-[#0052D9]/40 transition-colors"
        >
          {collapsed ? `+${collapsedCount}` : "－"}
        </button>
      )}

      <div className={`relative ${baseBg} ${ring} rounded-xl overflow-hidden shadow-sm group/action transition-all duration-200 hover:scale-[1.03] hover:shadow-xl`}>
        {/* 左侧紧急度细色条：未结束（待开始/待接受/进行中）显示；已完成/已中止/已拒绝等终态不显示 */}
        {ACTIVE_STATUS.has(task.status) && (
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${urgencyBar[task.urgency] || "bg-slate-300"}`} title={`紧急度：${task.urgency}`} />
        )}

        <div className="relative pl-4 pr-3 py-3">
          {/* toolbar — 整条 hover 时浮现 */}
          {editable && (
            <div className="absolute top-2 right-2 z-20 flex items-center gap-0.5 opacity-0 group-hover/action:opacity-100 transition-opacity">
              <MiniBtn onClick={onEdit} title="编辑"><Pencil size={12} /></MiniBtn>
              <MiniBtn onClick={(e) => { e.stopPropagation(); onToggleMark?.(task.id); }} title="标记整条线" active={isMarkRoot} activeClass="bg-violet-500 text-white"><Flag size={12} /></MiniBtn>
              {onCopy && <MiniBtn onClick={(e) => { e.stopPropagation(); onCopy(); }} title="复制此节点及子树" active={isCopied} activeClass="bg-[#0052D9] text-white"><Copy size={12} /></MiniBtn>}
              {onPaste && <MiniBtn onClick={(e) => { e.stopPropagation(); onPaste(); }} title="粘贴为子节点"><ClipboardPaste size={12} /></MiniBtn>}
              <MiniBtn onClick={() => { if (confirm(`删除执行任务「${task.title}」及其所有子任务？`)) onDelete?.(task.id); }} title="删除"><Trash2 size={12} /></MiniBtn>
              <button
                onClick={(e) => { e.stopPropagation(); onAddChild?.(); }}
                title="基于此动作添加思路"
                className="w-6 h-6 rounded-full bg-[#0052D9] text-white shadow-sm flex items-center justify-center hover:bg-[#003FA8]"
              >
                <Plus size={13} />
              </button>
            </div>
          )}

          {/* 状态栏 */}
          <div className="flex items-center gap-1.5 mb-1.5 pr-14" title={task.status}>
            <StatusBadge status={task.status} size={18} />
          </div>

          {/* ① 任务名称（动作） */}
          <button
            onClick={() => onTaskClick?.(task.id)}
            className="text-[13px] font-semibold text-slate-900 leading-snug hover:text-[#0052D9] text-left w-full"
          >
            {task.title}
          </button>

        {/* 状态驱动的内容（R27）：进行中=预期 / 已完成=结论+有效性 / 已中止=中止理由 / 已拒绝=拒绝理由 / 待开始·待接受=仅名称(待接受附预期) */}
        {(task.status === "待接受" || task.status === "进行中") && task.expectation && (
          <div className="mt-2 flex items-start gap-1.5">
            <span className="shrink-0 text-[10px] text-slate-400 mt-px w-7">预期</span>
            <p className="flex-1 text-[11px] text-slate-600 leading-snug line-clamp-2">{task.expectation}</p>
          </div>
        )}
        {task.status === "已完成" && (task.conclusion || task.validity) && (
          <div className="mt-1.5 flex items-start gap-1.5">
            <span className="shrink-0 text-[10px] text-slate-400 mt-px w-7">结论</span>
            <div className="flex-1 min-w-0">
              {task.conclusion && (
                <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">{task.conclusion}</p>
              )}
              {task.validity && (
                <button
                  onClick={(e) => { e.stopPropagation(); onTaskClick?.(task.id); }}
                  title="查看 Workspace 笔记"
                  className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border cursor-pointer transition-[filter] hover:brightness-95 ${validityColors[task.validity]}`}
                >
                  <ValidityIcon v={task.validity} /> 结论{task.validity} <ExternalLink size={10} />
                </button>
              )}
            </div>
          </div>
        )}
        {task.status === "已中止" && task.terminateReason && (
          <div className="mt-2 flex items-start gap-1.5">
            <span className="shrink-0 text-[10px] text-slate-400 mt-px w-7">中止</span>
            <p className="flex-1 text-[11px] text-slate-500 leading-snug line-clamp-2">{task.terminateReason}</p>
          </div>
        )}
        {task.status === "已拒绝" && task.rejectReason && (
          <div className="mt-2 flex items-start gap-1.5">
            <span className="shrink-0 text-[10px] text-rose-400 mt-px w-7">拒绝</span>
            <p className="flex-1 text-[11px] text-rose-600/90 leading-snug line-clamp-2">{task.rejectReason}</p>
          </div>
        )}

        {/* hover 展开：负责人(悬停看部门) / 预期完成 / 录音 / 数据 / 点赞评论 */}
        <div className="max-h-0 opacity-0 group-hover/action:max-h-[360px] group-hover/action:opacity-100 overflow-hidden transition-all duration-200">
          <div className="mt-2 pt-2 border-t border-slate-200/70 space-y-1.5 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <User size={11} /> 负责人：
              <span className="relative group/own text-slate-700 underline decoration-dotted decoration-slate-300 cursor-help">
                {task.owner}
                <span className="pointer-events-none absolute left-0 top-full mt-1 z-30 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover/own:opacity-100 transition-opacity">
                  部门：{task.department}
                </span>
              </span>
            </div>
            {task.dueDate && <div className="flex items-center gap-1.5"><Calendar size={11} /> 预期完成：{task.dueDate}</div>}
            {(task.attachments?.length || task.voiceNote) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {task.attachments && task.attachments.length > 0 && (
                  <>
                    <span className="text-slate-400 shrink-0">附件：</span>
                <span className="flex flex-wrap items-center gap-1">
                  {task.attachments.map((a, i) => (
                    <span
                      key={i}
                      title={a.name}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/70 border border-slate-200 text-[10px] text-slate-600 hover:border-[#0052D9] hover:text-[#0052D9] cursor-pointer transition-colors"
                    >
                      <AttIcon kind={a.kind} /> {a.name}
                    </span>
                  ))}
                </span>
                  </>
                )}
                {task.voiceNote && <VoicePlayer src={task.voiceNote} />}
              </div>
            )}
            <div className="pt-1 flex items-center gap-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleLike?.(task.id); }}
                className={`h-5 px-1.5 text-[10px] rounded inline-flex items-center gap-0.5 ${
                  task.likedByMe ? "bg-[#0052D9]/10 text-[#0052D9]" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <ThumbsUp size={10} /> {task.likes || 0}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onOpenComments?.(task.id); }}
                className="h-5 px-1.5 text-[10px] rounded inline-flex items-center gap-0.5 text-slate-500 hover:bg-slate-100"
              >
                <MessageCircle size={10} /> {(task.comments || []).length}
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

// ---- Add Button Node ----
function AddButtonNodeComponent({ data }: { data: any }) {
  const { onClick, direction, guideHighlight } = data;
  return (
    <div className="relative">
      <Handle type="target" position={direction === "LR" ? Position.Left : Position.Top} />
      {guideHighlight && (
        <>
          <span className="pointer-events-none absolute -inset-2 rounded-full ring-4 ring-amber-400/70 animate-ping" />
          <span className="pointer-events-none absolute -inset-2 rounded-full ring-2 ring-amber-400" />
          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-11 whitespace-nowrap rounded-lg bg-amber-500 text-white text-[11px] font-medium px-2.5 py-1 shadow-lg">
            ① 点这里新建第一个思路
          </div>
        </>
      )}
      <button
        onClick={onClick}
        className={`w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center transition-all shadow-sm bg-white ${
          guideHighlight
            ? "border-amber-400 text-amber-500 bg-amber-50"
            : "border-slate-300 hover:border-[#0052D9] hover:bg-[#0052D9]/5 text-slate-400 hover:text-[#0052D9]"
        }`}
        title="添加新思路"
      >
        <Plus size={20} />
      </button>
    </div>
  );
}
