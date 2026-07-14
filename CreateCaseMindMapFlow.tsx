import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  ReactFlowInstance,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Trash2, Edit2, User, Shield, Calendar, Users, X, Check, Maximize2, Minimize2, MousePointer2, Eye, AlarmClock, Flag, MoveVertical, MoveHorizontal, Tag } from "lucide-react";
import { CaseItem, Urgency, ownerToDepartment, urgencyBar, currentUser } from "./data";
import { ActionCard, ThoughtGroup } from "./CreateCase";
import { AttachmentInput } from "./AttachmentInput";
import { VoicePlayer, VoiceRecorder } from "./VoiceNote";
import { StatusBadge } from "./StatusBadge";
import { CaseProductPill } from "./CaseProductPill";

// ---- 思路模板：因为__原理说明__所以__（与 case 详情导图一致的填写引导）----
const THOUGHT_CATEGORIES = ["设计", "工艺", "测试", "其他"];
const MM_DEPARTMENTS = ["PTE", "CP", "FT", "DA", "PE", "QA", "EFA", "RD", "PM"];
const CREATE_STATUS_OPTIONS = ["全部", "待开始", "待接受", "进行中", "已完成", "已中止", "已拒绝"];
const THOUGHT_PLACEHOLDER = "新的思路/怀疑方向";
const MM_CREATE_SPOTLIGHT_KEY = "ea_mm_create_spotlight_v8";
type Direction = "LR" | "TB";
type CreateViewMode = "all" | "incomplete" | "valid";
type CoachStep = "fullscreen" | "minimap" | "zoomIn" | "zoomOut" | "fitView" | "toolbar" | "thoughtCategory" | "thought" | "thoughtResult" | "addTask" | "task" | "legend" | "more" | "nested";
const COACH_STEPS: CoachStep[] = ["fullscreen", "minimap", "zoomIn", "zoomOut", "fitView", "toolbar", "thoughtCategory", "thought", "thoughtResult", "addTask", "task", "legend", "more", "nested"];

const COACH_CONTENT: Record<CoachStep, { index: number; title: string; description: string; target: string }> = {
  fullscreen: {
    index: 1,
    title: "全屏查看",
    description: "点击进入全屏模式。",
    target: '[data-create-guide="fullscreen"]',
  },
  minimap: {
    index: 2,
    title: "缩略图",
    description: "点击拖动，快速定位。",
    target: ".create-case-flow .react-flow__minimap",
  },
  zoomIn: {
    index: 3,
    title: "放大画布",
    description: "放大画布，查看细节。",
    target: '.create-case-flow .react-flow__controls button[title="Zoom In"]',
  },
  zoomOut: {
    index: 4,
    title: "缩小画布",
    description: "缩小画布，总览全局。",
    target: '.create-case-flow .react-flow__controls button[title="Zoom Out"]',
  },
  fitView: {
    index: 5,
    title: "适配视图",
    description: "自动调整画布，完整显示全部节点。",
    target: '.create-case-flow .react-flow__controls button[title="Fit View"]',
  },
  toolbar: {
    index: 6,
    title: "顶部工具栏",
    description: "切换视图、筛选任务或调整布局。",
    target: '[data-create-guide="toolbar"]',
  },
  thoughtCategory: {
    index: 7,
    title: "选择思路分类",
    description: "选择设计、工艺、测试或其他。",
    target: '[data-create-guide="thought-category"]',
  },
  thought: {
    index: 8,
    title: "填写怀疑依据",
    description: "先填写「因为」，说明观察到的现象。",
    target: '[data-create-guide="thought-input"]',
  },
  thoughtResult: {
    index: 9,
    title: "填写怀疑结论",
    description: "填写「所以」，然后确认思路。",
    target: '[data-create-guide="thought-result"]',
  },
  addTask: {
    index: 10,
    title: "添加执行任务",
    description: "点击蓝色加号，添加相关任务。",
    target: '[data-create-guide="add-task"]',
  },
  task: {
    index: 11,
    title: "填写第一个任务",
    description: "填写相关信息，点击确认，创建任务。",
    target: '[data-create-guide="task"]',
  },
  legend: {
    index: 12,
    title: "理解紧急程度",
    description: "图例颜色对应任务卡左侧色条，快速识别紧急程度。",
    target: '[data-create-guide="legend"]',
  },
  more: {
    index: 13,
    title: "添加更多思路",
    description: "点击「新建思路」，增加并列排查方向。",
    target: '[data-create-guide="case-add-thought"]',
  },
  nested: {
    index: 14,
    title: "添加更多细节思路",
    description: "点击蓝色加号，添加更多子思路。",
    target: '[data-create-guide="saved-task"]',
  },
};
function composeThought(parts: [string, string, string]): string {
  const [a, b, c] = parts.map((s) => (s || "").trim());
  if (!a && !b && !c) return "";
  return `因为${a}，原理说明${b}，所以${c}。`;
}
function parseThought(title: string): [string, string, string] {
  if (!title || title === THOUGHT_PLACEHOLDER) return ["", "", ""];
  const normalized = title.endsWith("。") ? title.slice(0, -1) : title;
  const m = normalized.match(/^因为([\s\S]*)，原理说明([\s\S]*)，所以([\s\S]*)$/);
  if (m) return [m[1], m[2], m[3]];
  return [title, "", ""];
}
interface Props {
  caseData: CaseItem;
  thoughtGroups: ThoughtGroup[];
  onGroupsChange: (groups: ThoughtGroup[]) => void;
}

export function CreateCaseMindMapFlow({ caseData, thoughtGroups, onGroupsChange }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [direction, setDirection] = useState<Direction>("LR");
  const [viewMode, setViewMode] = useState<CreateViewMode>("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [statusFilter, setStatusFilter] = useState("全部");
  const [deptFilter, setDeptFilter] = useState("全部");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [manualPos, setManualPos] = useState<Record<string, { x: number; y: number }>>({});
  const [editingThought, setEditingThought] = useState<string | null>(null);
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [thoughtText, setThoughtText] = useState("");
  const [thoughtCategory, setThoughtCategory] = useState("测试");
  const [actionForm, setActionForm] = useState<Partial<ActionCard>>({});
  const seededRef = useRef(false);
  const coachAdvanceTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (coachAdvanceTimerRef.current !== null) window.clearTimeout(coachAdvanceTimerRef.current);
  }, []);

  // ---- 新建 Case 专用 Spotlight 引导：首次自动出现，填写动作会推进步骤 ----
  const [coach, setCoach] = useState<{ active: boolean; step: CoachStep }>(() => {
    try {
      return { active: !localStorage.getItem(MM_CREATE_SPOTLIGHT_KEY), step: "fullscreen" };
    } catch {
      return { active: true, step: "fullscreen" };
    }
  });
  const closeCoach = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      try { localStorage.setItem(MM_CREATE_SPOTLIGHT_KEY, "1"); } catch {}
    }
    setCoach((c) => ({ ...c, active: false }));
  };

  // Extract participants
  const extractParticipants = (groups: ThoughtGroup[]): Array<{ name: string; department: string; count: number }> => {
    const participantMap = new Map<string, { department: string; count: number }>();

    const extractFromGroups = (groups: ThoughtGroup[]) => {
      groups.forEach((group) => {
        group.actions.forEach((action) => {
          const assignee = action.assignee?.trim();
          if (assignee && assignee !== "待指派") {
            const key = `${assignee}-${action.department}`;
            const existing = participantMap.get(key);
            if (existing) {
              existing.count += 1;
            } else {
              participantMap.set(key, { department: action.department, count: 1 });
            }
          }
          if (action.childGroups && action.childGroups.length > 0) {
            extractFromGroups(action.childGroups);
          }
        });
      });
    };

    extractFromGroups(groups);

    return Array.from(participantMap.entries()).map(([key, value]) => ({
      name: key.split("-")[0],
      department: value.department,
      count: value.count,
    }));
  };

  const participants = extractParticipants(thoughtGroups);
  const allActions = useMemo(() => {
    const actions: ActionCard[] = [];
    const collect = (groups: ThoughtGroup[]) => groups.forEach((group) => group.actions.forEach((action) => {
      actions.push(action);
      if (action.childGroups?.length) collect(action.childGroups);
    }));
    collect(thoughtGroups);
    return actions;
  }, [thoughtGroups]);
  const deptOptions = useMemo(
    () => ["全部", ...Array.from(new Set(allActions.map((action) => action.department).filter(Boolean)))],
    [allActions]
  );
  const collapsibleActionIds = useMemo(
    () => allActions.filter((action) => action.childGroups?.length).map((action) => action.id),
    [allActions]
  );

  // 新建思路时只创建思路；任务由用户确认思路后手动添加
  const addThoughtGroup = () => {
    const newGroup: ThoughtGroup = {
      id: `group-${Date.now()}`,
      thought: "新的思路/怀疑方向",
      category: "测试",
      actions: [],
    };

    onGroupsChange([...thoughtGroups, newGroup]);

    setThoughtText("");
    setThoughtCategory("测试");
    setEditingThought(newGroup.id);
  };

  // Update thought
  const updateThought = (groupId: string, newThought: string, newCategory?: string) => {
    const updateInGroups = (groups: ThoughtGroup[]): ThoughtGroup[] => {
      return groups.map((g) => {
        if (g.id === groupId) {
          return { ...g, thought: newThought, category: newCategory ?? g.category };
        }
        return {
          ...g,
          actions: g.actions.map((a) => ({
            ...a,
            childGroups: a.childGroups ? updateInGroups(a.childGroups) : a.childGroups,
          })),
        };
      });
    };
    onGroupsChange(updateInGroups(thoughtGroups));
    setEditingThought(null);
    if (newThought.trim()) {
      setCoach((c) => (c.active && (c.step === "thought" || c.step === "thoughtResult") ? { ...c, step: "addTask" } : c));
    }
  };

  // Delete group
  const deleteGroup = (groupId: string) => {
    const deleteFromGroups = (groups: ThoughtGroup[]): ThoughtGroup[] => {
      return groups.filter((g) => g.id !== groupId).map((g) => ({
        ...g,
        actions: g.actions.map((a) => ({
          ...a,
          childGroups: a.childGroups ? deleteFromGroups(a.childGroups) : a.childGroups,
        })),
      }));
    };
    onGroupsChange(deleteFromGroups(thoughtGroups));
  };

  // Add action (enters edit mode automatically)
  const addAction = (groupId: string) => {
    const newActionId = `action-${Date.now()}`;
    const newAction: ActionCard = {
      id: newActionId,
      title: "新执行任务",
      urgency: "一般",
      department: "PTE",
      assignee: "",
      dueDate: "",
      note: "",
    };
    const addToGroups = (groups: ThoughtGroup[]): ThoughtGroup[] => {
      return groups.map((g) => {
        if (g.id === groupId) {
          return { ...g, actions: [...g.actions, newAction] };
        }
        return {
          ...g,
          actions: g.actions.map((a) => ({
            ...a,
            childGroups: a.childGroups ? addToGroups(a.childGroups) : a.childGroups,
          })),
        };
      });
    };
    onGroupsChange(addToGroups(thoughtGroups));
    // Auto-enter edit mode
    setActionForm(newAction);
    setEditingAction(newActionId);
    setCoach((c) => (c.active && c.step === "addTask" ? { ...c, step: "task" } : c));
  };

  // Delete action
  const deleteAction = (groupId: string, actionId: string) => {
    const deleteFromGroups = (groups: ThoughtGroup[]): ThoughtGroup[] => {
      return groups.map((g) => {
        if (g.id === groupId) {
          return { ...g, actions: g.actions.filter((a) => a.id !== actionId) };
        }
        return {
          ...g,
          actions: g.actions.map((a) => ({
            ...a,
            childGroups: a.childGroups ? deleteFromGroups(a.childGroups) : a.childGroups,
          })),
        };
      });
    };
    onGroupsChange(deleteFromGroups(thoughtGroups));
  };

  // Update action
  const updateAction = (groupId: string, actionId: string, updates: Partial<ActionCard>) => {
    const updateInGroups = (groups: ThoughtGroup[]): ThoughtGroup[] => {
      return groups.map((g) => {
        if (g.id === groupId) {
          return {
            ...g,
            actions: g.actions.map((a) => (a.id === actionId ? { ...a, ...updates } : a)),
          };
        }
        return {
          ...g,
          actions: g.actions.map((a) => ({
            ...a,
            childGroups: a.childGroups ? updateInGroups(a.childGroups) : a.childGroups,
          })),
        };
      });
    };
    onGroupsChange(updateInGroups(thoughtGroups));
    setEditingAction(null);
    if ((updates.title || "").trim()) {
      if (coachAdvanceTimerRef.current !== null) window.clearTimeout(coachAdvanceTimerRef.current);
      coachAdvanceTimerRef.current = window.setTimeout(() => {
        setCoach((c) => (c.active && c.step === "task" ? { ...c, step: "legend" } : c));
        coachAdvanceTimerRef.current = null;
      }, 520);
    }
  };

  // 在任务下新增子思路，任务仍由用户确认子思路后手动添加
  const addChildGroupToAction = (groupId: string, actionId: string) => {
    const newGroup: ThoughtGroup = {
      id: `group-${Date.now()}`,
      thought: "新的思路/怀疑方向",
      category: "测试",
      actions: [],
    };

    const addToGroups = (groups: ThoughtGroup[]): ThoughtGroup[] => {
      return groups.map((g) => {
        if (g.id === groupId) {
          return {
            ...g,
            actions: g.actions.map((a) => {
              if (a.id === actionId) {
                return {
                  ...a,
                  childGroups: [...(a.childGroups || []), newGroup],
                };
              }
              return {
                ...a,
                childGroups: a.childGroups ? addToGroups(a.childGroups) : a.childGroups,
              };
            }),
          };
        }
        return {
          ...g,
          actions: g.actions.map((a) => ({
            ...a,
            childGroups: a.childGroups ? addToGroups(a.childGroups) : a.childGroups,
          })),
        };
      });
    };
    onGroupsChange(addToGroups(thoughtGroups));

    setThoughtText("");
    setThoughtCategory("测试");
    setEditingThought(newGroup.id);
  };

  // 画布为空时始终预置第一个「思路 + 连接的执行动作」并进入填写
  useEffect(() => {
    if (!seededRef.current && thoughtGroups.length === 0) {
      seededRef.current = true;
      addThoughtGroup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thoughtGroups.length]);

  // Convert to React Flow nodes and edges
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const caseX = 50;
    const caseY = 300;
    const place = (depth: number, cross: number) => direction === "LR" ? { x: depth, y: cross } : { x: cross, y: depth };

    // Add case node
    nodes.push({
      id: "case",
      type: "caseNode",
      position: manualPos.case || place(caseX, caseY),
      data: {
        caseItem: caseData,
        direction,
        onAddThought: addThoughtGroup,
        guideAddThought: coach.active && coach.step === "more",
      },
    });

    const firstThoughtXOffset = 380;
    const branchXOffset = 840;
    const ySpacing = 250;

    // Recursively add nodes
    const addGroupNodes = (
      groups: ThoughtGroup[],
      parentId: string,
      parentType: "case" | "action",
      level: number,
      yStart: number
    ) => {
      let currentY = yStart;

      groups.forEach((group, groupIndex) => {
        // 第一层思路紧邻 Case 根节点；更深层级再逐层向右展开
        const thoughtDepth = caseX + firstThoughtXOffset + (level - 1) * branchXOffset;
        const thoughtCross = currentY;
        const thoughtPosition = manualPos[group.id] || place(thoughtDepth, thoughtCross);

        // Add thought node
        nodes.push({
          id: group.id,
          type: "thoughtNode",
          position: thoughtPosition,
          draggable: editingThought !== group.id,
          data: {
            group,
            direction,
            guideTarget: coach.active && coach.step === "thought",
            guideAddTask: coach.active && coach.step === "addTask",
            isEditing: editingThought === group.id,
            thoughtText,
            setThoughtText,
            thoughtCategory,
            setThoughtCategory,
            onEdit: () => {
              setThoughtText(group.thought === THOUGHT_PLACEHOLDER ? "" : group.thought);
              setThoughtCategory(group.category || "测试");
              setEditingThought(group.id);
            },
            onSave: () => updateThought(group.id, thoughtText, thoughtCategory),
            onCancel: () => setEditingThought(null),
            onDelete: () => deleteGroup(group.id),
            onAddAction: () => addAction(group.id),
          },
        });

        edges.push({
          id: `${parentId}-${group.id}`,
          source: parentId,
          target: group.id,
          sourceHandle: direction === "LR" ? "right" : "bottom",
          targetHandle: direction === "LR" ? "left" : "top",
          type: "smoothstep",
          pathOptions: { borderRadius: 10, offset: 28 },
          style: { stroke: "#cbd5e1", strokeWidth: 2 },
        });

        // Add action nodes below thought node
        // 任务卡始终排列在思路卡右侧；思路被拖动后也会以其实际位置为基准
        let actionY = thoughtPosition.y;
        group.actions.forEach((action, actionIndex) => {
          const autoActionPosition = direction === "LR"
            ? { x: thoughtPosition.x + 460, y: actionY }
            : { x: actionY, y: thoughtPosition.y + 360 };
          const dimmed =
            (onlyMine && action.assignee !== currentUser.name) ||
            (statusFilter !== "全部" && statusFilter !== "待接受") ||
            (deptFilter !== "全部" && action.department !== deptFilter);

          nodes.push({
            id: action.id,
            type: "actionNode",
            position: manualPos[action.id] || autoActionPosition,
            draggable: editingAction !== action.id,
            data: {
              action,
              direction,
              dimmed,
              guideUrgency: coach.active && coach.step === "legend" && action.id === actionForm.id,
              guideTarget: coach.active && coach.step === "task",
              guideAddChild: coach.active && coach.step === "nested" && editingAction !== action.id,
              groupId: group.id,
              isEditing: editingAction === action.id,
              actionForm,
              setActionForm,
              onEdit: () => {
                setActionForm(action);
                setEditingAction(action.id);
              },
              onSave: () => updateAction(group.id, action.id, actionForm as ActionCard),
              onCancel: () => setEditingAction(null),
              onDelete: () => deleteAction(group.id, action.id),
              onAddChildGroup: () => addChildGroupToAction(group.id, action.id),
            },
          });

          // Edge from thought to action
          edges.push({
            id: `${group.id}-${action.id}`,
            source: group.id,
            target: action.id,
            sourceHandle: direction === "LR" ? "right" : "bottom",
            targetHandle: direction === "LR" ? "left" : "top",
            type: "smoothstep",
            pathOptions: { borderRadius: 10, offset: 28 },
            zIndex: 2,
            style: { stroke: "#94a3b8", strokeWidth: 2 },
          });

          // Recursively add child groups from actions
          if (action.childGroups && action.childGroups.length > 0 && !collapsed.has(action.id)) {
            const childYStart = actionY - (action.childGroups.length * ySpacing) / 2;
            addGroupNodes(action.childGroups, action.id, "action", level + 1, childYStart);
          }

          actionY += ySpacing;
        });

        currentY += ySpacing * Math.max(1, group.actions.length);
      });
    };

    const totalHeight = thoughtGroups.reduce((sum, g) => sum + g.actions.length * ySpacing, 0);
    addGroupNodes(thoughtGroups, "case", "case", 1, caseY - totalHeight / 2);

    return { nodes, edges };
  }, [thoughtGroups, editingThought, editingAction, thoughtText, thoughtCategory, actionForm, caseData, coach, manualPos, direction, onlyMine, statusFilter, deptFilter, collapsed, viewMode]);

  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges] = useEdgesState(edges);

  // Update nodes when dependencies change
  useMemo(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);

  // 分步新增节点后重新适配画布，保证 Case 根节点与当前卡片始终同时完整可见
  useEffect(() => {
    if (!flowInstance || flowNodes.length === 0) return;
    const frame = requestAnimationFrame(() => {
      flowInstance.fitView({ padding: 0.18, maxZoom: 0.95, duration: 260 });
    });
    return () => cancelAnimationFrame(frame);
  }, [flowInstance, flowNodes.length]);

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      caseNode: CaseNodeComponent,
      thoughtNode: ThoughtNodeEditComponent,
      actionNode: ActionNodeEditComponent,
    }),
    []
  );

  return (
    <div className="space-y-4">
      {/* Participants */}
      {participants.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-[#0052D9]" />
            <h4 className="text-sm font-medium text-slate-900">Case 参与人员</h4>
            <span className="text-xs text-slate-500">
              共 <b className="text-[#0052D9]">{participants.length}</b> 人参与，
              <b className="text-[#0052D9]">{participants.reduce((sum, p) => sum + p.count, 0)}</b> 个任务
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {participants.map((participant, idx) => (
              <div
                key={`${participant.name}-${participant.department}-${idx}`}
                className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-white border border-slate-200 shadow-sm"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#0052D9] to-[#7A3DFF] flex items-center justify-center text-white text-[10px] font-medium">
                  {participant.name.charAt(0)}
                </div>
                <span className="text-sm text-slate-900 font-medium">{participant.name}</span>
                <span className="text-xs text-slate-500">· {participant.department}</span>
                {participant.count > 1 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[#0052D9]/10 text-[10px] text-[#0052D9] font-medium">
                    {participant.count}个任务
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* React Flow Canvas */}
      <div
        ref={canvasRef}
        className={
          fullscreen
            ? "fixed inset-0 z-50 bg-gradient-to-br from-slate-50 to-white"
            : "relative bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-lg overflow-hidden"
        }
      >
          <div data-create-guide="toolbar" className="absolute top-3 left-3 z-10 flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center bg-white/95 border border-slate-200 rounded-lg p-0.5 shadow-sm">
              {([
                { key: "all", label: "全局视图", icon: Eye },
                { key: "incomplete", label: "只看未完成", icon: AlarmClock },
                { key: "valid", label: "只看有效路径", icon: Flag },
              ] as { key: CreateViewMode; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`h-7 px-2.5 rounded-md text-xs inline-flex items-center gap-1 transition-all ${viewMode === key ? "bg-[#0052D9] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
              <span className="w-px h-4 bg-slate-200 mx-0.5" />
              <button
                onClick={() => setOnlyMine((value) => !value)}
                title="只看我负责的任务"
                className={`h-7 px-2.5 rounded-md text-xs inline-flex items-center gap-1 transition-all ${onlyMine ? "bg-[#0052D9] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
              >
                <User size={12} /> 只看我的
              </button>
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              title="按任务状态筛选"
              className={`h-8 px-2 rounded-lg border shadow-sm text-xs outline-none cursor-pointer ${statusFilter === "全部" ? "bg-white/95 border-slate-200 text-slate-600" : "bg-[#0052D9] text-white border-[#0052D9]"}`}
            >
              {CREATE_STATUS_OPTIONS.map((status) => <option key={status} value={status} className="text-slate-700">{status === "全部" ? "状态：全部" : status}</option>)}
            </select>
            <select
              value={deptFilter}
              onChange={(event) => setDeptFilter(event.target.value)}
              title="按部门筛选"
              className={`h-8 px-2 rounded-lg border shadow-sm text-xs outline-none cursor-pointer ${deptFilter === "全部" ? "bg-white/95 border-slate-200 text-slate-600" : "bg-[#0052D9] text-white border-[#0052D9]"}`}
            >
              {deptOptions.map((department) => <option key={department} value={department} className="text-slate-700">{department === "全部" ? "部门：全部" : department}</option>)}
            </select>
            <button
              onClick={() => { setDirection((value) => value === "LR" ? "TB" : "LR"); setManualPos({}); }}
              title={direction === "LR" ? "切换为竖向布局" : "切换为横向布局"}
              className="h-8 px-2.5 rounded-lg bg-white/95 border border-slate-200 shadow-sm text-xs text-slate-600 hover:text-[#0052D9] inline-flex items-center gap-1"
            >
              {direction === "LR" ? <MoveVertical size={13} /> : <MoveHorizontal size={13} />}
              {direction === "LR" ? "竖向" : "横向"}
            </button>
            <button
              onClick={() => setCollapsed((previous) => previous.size ? new Set() : new Set(collapsibleActionIds))}
              disabled={collapsibleActionIds.length === 0}
              title="折叠已完成/死路 或 全部展开"
              className="h-8 px-2.5 rounded-lg bg-white/95 border border-slate-200 shadow-sm text-xs text-slate-600 hover:text-[#0052D9] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              {collapsed.size ? "展开全部" : "折叠已完成"}
            </button>
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
          data-create-guide="fullscreen"
          onClick={() => setFullscreen((value) => !value)}
          title={fullscreen ? "退出全屏" : "全屏"}
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-md bg-white/90 border border-slate-200 shadow-sm hover:bg-white flex items-center justify-center text-slate-600 hover:text-[#0052D9]"
        >
          {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>

        <div className={`${fullscreen ? "h-full w-full" : "h-[700px]"} create-case-flow`}>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onInit={setFlowInstance}
            onNodesChange={onNodesChange}
            onNodeDragStop={(_, node) =>
              setManualPos((positions) => ({
                ...positions,
                [node.id]: { x: node.position.x, y: node.position.y },
              }))
            }
            fitView
            fitViewOptions={{ padding: 0.18, maxZoom: 0.95 }}
            minZoom={0.2}
            maxZoom={1.5}
            defaultViewport={{ x: 100, y: 100, zoom: 0.8 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
            <MiniMap zoomable pannable nodeColor={(node) => {
              if (node.type === 'caseNode') return '#334155';
              if (node.type === 'thoughtNode') return '#F59E0B';
              if (node.type === 'actionNode') return '#0052D9';
              return '#CBD5E1';
            }} />
          </ReactFlow>
        </div>

        <div data-create-guide="legend" className="absolute bottom-3.5 left-[58px] z-10 px-3 py-1.5 text-[11px] text-slate-500 bg-white/95 border border-slate-200 rounded-lg shadow-sm flex items-center gap-2.5">
            {onlyMine && <span className="text-[#0052D9] font-medium">已聚焦我的</span>}
            <span className="text-slate-400">紧急度</span>
            <span className={`inline-flex items-center gap-1 rounded px-1 py-0.5 transition-all ${coach.active && coach.step === "legend" && actionForm.urgency === "非常紧急" ? "bg-red-50 text-red-600 ring-1 ring-red-200" : ""}`}><span className="inline-block w-0.5 h-3 bg-red-400" />非常紧急</span>
            <span className={`inline-flex items-center gap-1 rounded px-1 py-0.5 transition-all ${coach.active && coach.step === "legend" && actionForm.urgency === "紧急" ? "bg-orange-50 text-orange-600 ring-1 ring-orange-200" : ""}`}><span className="inline-block w-0.5 h-3 bg-orange-400" />紧急</span>
            <span className={`inline-flex items-center gap-1 rounded px-1 py-0.5 transition-all ${coach.active && coach.step === "legend" && (actionForm.urgency || "一般") === "一般" ? "bg-sky-50 text-sky-600 ring-1 ring-sky-200" : ""}`}><span className="inline-block w-0.5 h-3 bg-sky-400" />一般</span>
            <span className={`inline-flex items-center gap-1 rounded px-1 py-0.5 transition-all ${coach.active && coach.step === "legend" && actionForm.urgency === "不紧急" ? "bg-slate-100 text-slate-700 ring-1 ring-slate-300" : ""}`}><span className="inline-block w-0.5 h-3 bg-slate-300" />不紧急</span>
        </div>

        {coach.active && (
          <CreateCaseSpotlight
            step={coach.step}
            container={canvasRef.current}
            onNext={() => {
              if (coach.step === "thoughtResult" && editingThought) {
                updateThought(editingThought, thoughtText, thoughtCategory);
                return;
              }
              setCoach((current) => ({
                ...current,
                step:
                  current.step === "fullscreen" ? "minimap" :
                  current.step === "minimap" ? "zoomIn" :
                  current.step === "zoomIn" ? "zoomOut" :
                  current.step === "zoomOut" ? "fitView" :
                  current.step === "fitView" ? "toolbar" :
                  current.step === "toolbar" ? "thoughtCategory" :
                  current.step === "thoughtCategory" ? "thought" :
                  current.step === "thought" ? "thoughtResult" :
                  current.step === "legend" ? "more" :
                  current.step === "more" ? "nested" : current.step,
              }));
            }}
            onGoTo={(nextStep) => setCoach((current) => ({ ...current, step: nextStep }))}
            canProceed={thoughtCategory === "其他"
              ? !!thoughtText.trim()
              : coach.step === "thoughtResult"
              ? !!parseThought(thoughtText)[2].trim()
              : !!parseThought(thoughtText)[0].trim()}
                isOtherThought={thoughtCategory === "其他"}
            onClose={closeCoach}
          />
        )}
      </div>
    </div>
  );
}

function CreateCaseSpotlight({ step, container, onNext, onGoTo, canProceed, isOtherThought, onClose }: { step: CoachStep; container: HTMLDivElement | null; onNext: () => void; onGoTo: (step: CoachStep) => void; canProceed: boolean; isOtherThought: boolean; onClose: (dontShowAgain: boolean) => void }) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [cardAnchor, setCardAnchor] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [urgencyRect, setUrgencyRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [bounds, setBounds] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const content = COACH_CONTENT[step];

  useEffect(() => {
    let frame = 0;
    let revealed = false;
    const update = () => {
      const element = document.querySelector(content.target) as HTMLElement | null;
      if (element && container) {
        if (!revealed) {
          revealed = true;
          if (step !== "legend") element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          if (step === "thought" || step === "thoughtResult") {
            window.setTimeout(() => {
              const input = (element.matches("input, textarea")
                ? element
                : element.querySelector("input, textarea")) as HTMLInputElement | HTMLTextAreaElement | null;
              input?.focus({ preventScroll: true });
            }, 120);
          }
        }
        const canvas = container.getBoundingClientRect();
        const canvasTop = Math.max(0, canvas.top);
        const canvasLeft = Math.max(0, canvas.left);
        const canvasRight = Math.min(window.innerWidth, canvas.right);
        const canvasBottom = Math.min(window.innerHeight, canvas.bottom);
        const nextBounds = {
          top: canvasTop,
          left: canvasLeft,
          width: Math.max(0, canvasRight - canvasLeft),
          height: Math.max(0, canvasBottom - canvasTop),
        };
        setBounds(nextBounds);
        const next = element.getBoundingClientRect();
        const urgencyElement = step === "legend" ? document.querySelector('[data-create-guide="urgency-bar"]') as HTMLElement | null : null;
        const urgency = urgencyElement?.getBoundingClientRect();
        setUrgencyRect(urgency ? { top: urgency.top, left: urgency.left, width: urgency.width, height: urgency.height } : null);
        const anchorElement = step === "nested" ? element.closest(".react-flow__node") as HTMLElement | null : null;
        const anchor = anchorElement?.getBoundingClientRect() || next;
        setCardAnchor({ top: anchor.top, left: anchor.left, width: anchor.width, height: anchor.height });
        const padding = step === "fullscreen" ? 7 : 10;
        const top = Math.max(canvasTop + 6, next.top - padding);
        const left = Math.max(canvasLeft + 6, next.left - padding);
        const right = Math.min(canvasRight - 6, next.right + padding);
        const bottom = Math.min(canvasBottom - 6, next.bottom + padding);
        setRect((current) => {
          const updated = { top, left, width: right - left, height: bottom - top };
          return current && Math.abs(current.top - top) < 0.5 && Math.abs(current.left - left) < 0.5 &&
            Math.abs(current.width - updated.width) < 0.5 && Math.abs(current.height - updated.height) < 0.5
            ? current
            : updated;
        });
      } else {
        setRect(null);
        setCardAnchor(null);
        setUrgencyRect(null);
        setBounds(null);
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [container, content.target, step]);

  if (!rect || !cardAnchor || !bounds) return null;

  const placementAnchor = step === "nested" ? cardAnchor : rect;
  const right = placementAnchor.left + placementAnchor.width;
  const bottom = placementAnchor.top + placementAnchor.height;
  const cardWidth = 320;
  const gap = 18;
  let cardLeft: number;
  let cardTop: number;
  const boundsRight = bounds.left + bounds.width;
  const boundsBottom = bounds.top + bounds.height;
  if (right + gap + cardWidth <= boundsRight - 12) {
    cardLeft = right + gap;
    cardTop = Math.min(placementAnchor.top, boundsBottom - 300);
  } else if (placementAnchor.left - gap - cardWidth >= bounds.left + 12) {
    cardLeft = placementAnchor.left - gap - cardWidth;
    cardTop = Math.min(placementAnchor.top, boundsBottom - 300);
  } else {
    cardLeft = Math.max(bounds.left + 12, Math.min(boundsRight - cardWidth - 12, placementAnchor.left));
    cardTop = bottom + gap + 250 <= boundsBottom ? bottom + gap : Math.max(bounds.top + 12, placementAnchor.top - 268);
  }
  cardTop = Math.max(bounds.top + 12, cardTop);

  const needsInteraction = (step === "thought" && isOtherThought) || step === "addTask" || step === "task";
  const isLast = step === "nested";
  const spotlightRadius = Math.min(14, rect.width / 3, rect.height / 3);
  const relativeRect = {
    x: rect.left - bounds.left,
    y: rect.top - bounds.top,
  };
  const legendLink = step === "legend" && urgencyRect ? {
    x1: rect.left + rect.width / 2,
    y1: rect.top,
    x2: urgencyRect.left + urgencyRect.width / 2,
    y2: urgencyRect.top + urgencyRect.height / 2,
  } : null;
  const spotlightTransition = step === "legend" ? 1100 : 680;
  const cardTransition = step === "legend" ? 1200 : 760;

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed z-[80] pointer-events-none overflow-hidden"
        style={{ top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height }}
      >
        <div
          className="absolute"
          style={{
            top: relativeRect.y,
            left: relativeRect.x,
            width: rect.width,
            height: rect.height,
            borderRadius: spotlightRadius,
            boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.66)",
            transition: `top ${spotlightTransition}ms cubic-bezier(.22,.8,.26,1), left ${spotlightTransition}ms cubic-bezier(.22,.8,.26,1), width ${spotlightTransition}ms cubic-bezier(.22,.8,.26,1), height ${spotlightTransition}ms cubic-bezier(.22,.8,.26,1), border-radius ${spotlightTransition}ms cubic-bezier(.22,.8,.26,1)`,
            willChange: "top, left, width, height",
          }}
        />
      </div>
      <div
        className="fixed z-[82] pointer-events-none"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          borderRadius: spotlightRadius,
          border: step === "thought" ? "1px solid rgba(251,191,36,.95)" : "1px solid rgba(125,211,252,.95)",
          boxShadow: step === "thought"
            ? "0 0 0 3px rgba(251,191,36,.18), 0 10px 34px rgba(245,158,11,.28), inset 0 0 0 1px rgba(255,255,255,.45)"
            : "0 0 0 3px rgba(56,189,248,.16), 0 10px 34px rgba(0,82,217,.28), inset 0 0 0 1px rgba(255,255,255,.45)",
          transition: `top ${spotlightTransition}ms cubic-bezier(.22,.8,.26,1), left ${spotlightTransition}ms cubic-bezier(.22,.8,.26,1), width ${spotlightTransition}ms cubic-bezier(.22,.8,.26,1), height ${spotlightTransition}ms cubic-bezier(.22,.8,.26,1), border-radius ${spotlightTransition}ms cubic-bezier(.22,.8,.26,1), border-color 320ms ease, box-shadow 320ms ease`,
          willChange: "top, left, width, height",
        }}
      />

      {legendLink && (
        <svg aria-hidden="true" className="fixed inset-0 z-[84] pointer-events-none w-screen h-screen">
          <defs>
            <filter id="legend-link-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path
            d={`M ${legendLink.x1} ${legendLink.y1} C ${legendLink.x1} ${legendLink.y1 - 54}, ${legendLink.x2 - 70} ${legendLink.y2}, ${legendLink.x2} ${legendLink.y2}`}
            fill="none"
            stroke="rgba(56,189,248,.95)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="7 6"
            filter="url(#legend-link-glow)"
          />
          <circle cx={legendLink.x1} cy={legendLink.y1} r="4" fill="#38bdf8" />
          <circle cx={legendLink.x2} cy={legendLink.y2} r="6" fill="rgba(56,189,248,.22)" stroke="#38bdf8" strokeWidth="2" />
          <rect
            x={urgencyRect.left - 5}
            y={urgencyRect.top - 5}
            width={urgencyRect.width + 10}
            height={urgencyRect.height + 10}
            rx="6"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
            filter="url(#legend-link-glow)"
          />
        </svg>
      )}

      <div
        className="fixed z-[90] w-[320px] overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl"
        style={{
          left: cardLeft,
          top: cardTop,
          transition: `left ${cardTransition}ms cubic-bezier(.22,.8,.26,1), top ${cardTransition}ms cubic-bezier(.22,.8,.26,1)`,
          willChange: "left, top",
        }}
      >
        <div className="bg-gradient-to-br from-[#0052D9] to-[#00A4FF] px-4 pt-3.5 pb-3 text-white">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-white/85">
              <MousePointer2 size={13} /> 新手引导 · {content.index} / {COACH_STEPS.length}
            </div>
            <button onClick={() => onClose(dontShowAgain)} title="关闭引导" className="w-6 h-6 rounded-md bg-white/15 hover:bg-white/25 flex items-center justify-center">
              <X size={13} />
            </button>
          </div>
          <div className="mt-1.5 text-[16px] font-bold leading-snug">{content.title}</div>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[12.5px] text-slate-600 leading-[1.7]">{content.description}</p>
          <div className="mt-3 flex items-center gap-1.5">
            {COACH_STEPS.map((coachStep, index) => index + 1 < content.index ? (
              <button
                key={coachStep}
                onClick={() => onGoTo(coachStep)}
                title={`第 ${index + 1} 步已完成，点击返回`}
                className="w-3 h-3 rounded-full bg-slate-400 text-white hover:bg-[#0052D9] hover:scale-110 transition-all inline-flex items-center justify-center"
              >
                <Check size={8} strokeWidth={3} />
              </button>
            ) : (
              <span key={coachStep} className={`h-1.5 rounded-full transition-all ${index + 1 === content.index ? "w-5 bg-[#0052D9]" : "w-1.5 bg-slate-200"}`} />
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3">
            <label className="text-[11.5px] text-slate-400 flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(event) => setDontShowAgain(event.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 accent-[#0052D9]"
              />
              下次不再显示
            </label>
            <div className="flex-1" />
            {!needsInteraction && (
              <button
                onClick={isLast ? () => onClose(dontShowAgain) : onNext}
                disabled={(step === "thought" || step === "thoughtResult") && !canProceed}
                className="h-8 px-4 rounded-lg bg-[#0052D9] text-white text-xs font-medium hover:bg-[#003FA8] disabled:bg-slate-300 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
              >
                {isLast ? <><Check size={14} /> 完成</> : step === "thoughtCategory" ? <>选择并继续</> : step === "thoughtResult" ? <>完成思路并继续</> : <>下一步</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Components for nodes remain similar but simplified for create mode
function CaseNodeComponent({ data }: { data: any }) {
  const { caseItem, direction, onAddThought, guideAddThought } = data;
  return (
    <div className="group/case relative bg-white border-2 border-slate-200 rounded-xl p-4 shadow-lg w-[280px]">
      <Handle type="source" position={direction === "LR" ? Position.Right : Position.Bottom} id={direction === "LR" ? "right" : "bottom"} />
      <button
        data-create-guide={guideAddThought ? "case-add-thought" : undefined}
        onClick={onAddThought}
        title="新建思路"
        className={`absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-[#0052D9] text-white shadow-sm flex items-center justify-center hover:bg-[#003FA8] transition-opacity ${guideAddThought ? "opacity-100" : "opacity-0 group-hover/case:opacity-100"}`}
      >
        <Plus size={14} />
      </button>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1">
          <div className="px-2 py-0.5 rounded text-xs border bg-slate-50 text-slate-600 border-slate-200">
            {caseItem.level || "L5"}
          </div>
          <CaseProductPill caseItem={caseItem} compact />
        </div>
        <div className="text-xs text-slate-400 font-mono">{caseItem.code}</div>
      </div>
      <h4 className="text-sm font-medium text-slate-900 leading-snug mb-2 line-clamp-2">
        {caseItem.name || "（未命名 Case）"}
      </h4>
      <div className="space-y-1.5 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <User size={12} />
          <span>Owner: {caseItem.owner}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Shield size={12} />
          <span>{caseItem.urgency}</span>
        </div>
      </div>
    </div>
  );
}

function ThoughtNodeEditComponent({ data }: { data: any }) {
  const {
    group,
    isEditing,
    thoughtText,
    setThoughtText,
    thoughtCategory,
    setThoughtCategory,
    onEdit,
    onSave,
    onCancel,
    onDelete,
    onAddAction,
    guideTarget,
    guideAddTask,
    direction,
  } = data;

  const isThoughtEmpty = !group.thought?.trim() || group.thought === THOUGHT_PLACEHOLDER;
  const isOtherCategory = thoughtCategory === "其他";
  const parts = isEditing ? parseThought(thoughtText) : ["", "", ""];
  const saveable = isOtherCategory
    ? !!thoughtText.trim()
    : !!(parts[0].trim() && parts[2].trim());
  const setPart = (idx: number, v: string) => {
    const next = [...parts] as [string, string, string];
    next[idx] = v;
    setThoughtText?.(composeThought(next));
  };

  return (
    <div data-create-guide={guideTarget ? "thought" : undefined} className="relative w-[320px] transition-all">
      <Handle type="target" position={direction === "LR" ? Position.Left : Position.Top} id={direction === "LR" ? "left" : "top"} />
      <Handle type="source" position={direction === "LR" ? Position.Right : Position.Bottom} id={direction === "LR" ? "right" : "bottom"} />

      <div className="relative bg-amber-50/60 border border-amber-300 rounded-xl p-3.5 group/thought transition-all duration-200 hover:scale-[1.03] hover:shadow-md">
        {!isEditing ? (
          <>
            <div className={`absolute top-2 right-2 z-20 flex items-center gap-0.5 transition-opacity ${guideAddTask ? "opacity-100" : "opacity-0 group-hover/thought:opacity-100"}`}>
              <button
                onClick={onEdit}
                title="编辑"
                className="w-6 h-6 rounded-md bg-white/90 border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-[#0052D9]"
              >
                <Edit2 size={12} />
              </button>
              <button
                onClick={() => { if (confirm(`删除思路「${group.thought}」及其所有执行任务？`)) onDelete?.(); }}
                title="删除"
                className="w-6 h-6 rounded-md bg-white/90 border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-red-500"
              >
                <Trash2 size={12} />
              </button>
              <button
                data-create-guide={guideAddTask ? "add-task" : undefined}
                onClick={onAddAction}
                title="添加执行任务"
                className="w-6 h-6 rounded-full bg-[#0052D9] text-white shadow-sm flex items-center justify-center hover:bg-[#003FA8]"
              >
                <Plus size={13} />
              </button>
            </div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[11px] text-amber-700 font-medium tracking-wide shrink-0">思路 / 怀疑方向</span>
              {group.category && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 border border-amber-200 shrink-0 whitespace-nowrap">
                  <Tag size={9} /> {group.category}
                </span>
              )}
            </div>
            {isThoughtEmpty ? (
              <button onClick={onEdit} className="text-left w-full text-[12px] text-amber-600/70 italic leading-relaxed hover:text-amber-700">
                点此填写：怀疑什么 + 为什么怀疑（一个方向写一个节点）
              </button>
            ) : (
              <p className="text-[13px] text-slate-800 leading-relaxed font-medium">{group.thought}</p>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-xs text-amber-700 font-medium">编辑思路 / 怀疑方向</div>
              <select
                data-create-guide="thought-category"
                value={thoughtCategory || "测试"}
                onChange={(e) => setThoughtCategory?.(e.target.value)}
                className="h-6 rounded-full border px-2 text-[11px] outline-none border-amber-300 text-amber-700 bg-amber-50"
              >
                {THOUGHT_CATEGORIES.map((cName) => (
                  <option key={cName} value={cName}>{cName}</option>
                ))}
              </select>
            </div>
            {isOtherCategory ? (
              <div>
                <div className="text-[11px] font-semibold text-slate-600 mb-1">工作思路 <span className="text-red-500">*</span></div>
                <textarea
                  data-create-guide="thought-input"
                  value={thoughtText}
                  onChange={(e) => setThoughtText?.(e.target.value)}
                  placeholder="请填写工作思路"
                  autoFocus
                  className="nodrag nopan w-full min-h-[88px] p-2 rounded border border-slate-200 bg-white text-[12.5px] leading-relaxed outline-none focus:border-amber-500 resize-y"
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-600 mb-1">因为 <span className="text-red-500">*</span></div>
                    <input
                      data-create-guide="thought-input"
                      value={parts[0]}
                      onChange={(e) => setPart(0, e.target.value)}
                      placeholder="看到什么失效现象，关联以往什么 case"
                      autoFocus
                      className="nodrag nopan w-full h-8 px-2 rounded border border-slate-200 bg-white text-[12.5px] outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-600 mb-1 inline-flex items-center gap-1.5">
                      原理说明 <span className="text-[10px] font-normal text-slate-400 border border-slate-200 rounded-full px-1.5 leading-4">选填</span>
                    </div>
                    <input
                      value={parts[1]}
                      onChange={(e) => setPart(1, e.target.value)}
                      placeholder="补充原理内容，可增加Case评分"
                      className="nodrag nopan w-full h-8 px-2 rounded border border-dashed border-slate-300 bg-slate-50 text-[12.5px] outline-none focus:border-slate-400 focus:bg-white"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-600 mb-1">所以 <span className="text-red-500">*</span></div>
                    <input
                      data-create-guide="thought-result"
                      value={parts[2]}
                      onChange={(e) => setPart(2, e.target.value)}
                      placeholder="怀疑和什么有关"
                      className="nodrag nopan w-full h-8 px-2 rounded border border-slate-200 bg-white text-[12.5px] outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                <div className="mt-1.5 text-[10px] text-amber-600/80">「因为」和「所以」必填，原理说明选填</div>
              </>
            )}
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={onSave}
                disabled={!saveable}
                className={`flex-1 h-7 rounded text-white text-xs ${saveable ? "bg-[#0052D9] hover:bg-[#003FA8]" : "bg-slate-300 cursor-not-allowed"}`}
              >
                确认
              </button>
              <button
                onClick={onCancel}
                className="flex-1 h-7 rounded border border-slate-200 text-slate-600 text-xs hover:bg-slate-50"
              >
                取消
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ActionNodeEditComponent({ data }: { data: any }) {
  const {
    action,
    isEditing,
    actionForm,
    setActionForm,
    onEdit,
    onSave,
    onCancel,
    onDelete,
    onAddChildGroup,
    guideTarget,
    guideAddChild,
    guideUrgency,
    direction,
    dimmed,
  } = data;

  return (
    <div
      data-create-guide={guideTarget ? "task" : undefined}
      className={`relative transition-opacity ${dimmed ? "opacity-25" : "opacity-100"} ${isEditing ? "w-[280px] z-50" : "w-[256px]"}`}
    >
      <Handle type="target" position={direction === "LR" ? Position.Left : Position.Top} id={direction === "LR" ? "left" : "top"} style={direction === "LR" && isEditing ? { top: 62 } : undefined} />
      <Handle type="source" position={direction === "LR" ? Position.Right : Position.Bottom} id={direction === "LR" ? "right" : "bottom"} />

      {!isEditing ? (
        <div className={`relative bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm group/action transition-all duration-200 hover:scale-[1.03] hover:shadow-xl ${guideUrgency ? "ring-2 ring-[#0052D9]/30 shadow-lg" : ""}`}>
          <div data-create-guide={guideUrgency ? "urgency-bar" : undefined} className={`absolute left-0 top-0 bottom-0 w-1 ${urgencyBar[action.urgency] || "bg-slate-300"} ${guideUrgency ? "animate-pulse" : ""}`} title={`紧急度：${action.urgency}`} />
          <div className="relative pl-4 pr-3 py-3">
            <div className={`absolute top-2 right-2 z-20 flex items-center gap-0.5 transition-opacity ${guideAddChild ? "opacity-100" : "opacity-0 group-hover/action:opacity-100"}`}>
              <button onClick={onEdit} title="编辑" className="w-6 h-6 rounded-md bg-white/90 border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-[#0052D9]">
                <Edit2 size={12} />
              </button>
              <button onClick={onDelete} title="删除" className="w-6 h-6 rounded-md bg-white/90 border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-red-500">
                <Trash2 size={12} />
              </button>
              <button data-create-guide={guideAddChild ? "saved-task" : undefined} onClick={onAddChildGroup} title="基于此动作添加思路" className="w-6 h-6 rounded-full bg-[#0052D9] text-white shadow-sm flex items-center justify-center hover:bg-[#003FA8]">
                <Plus size={13} />
              </button>
            </div>
            <div className="flex items-center gap-1.5 mb-1.5 pr-14" title="待接受">
              <StatusBadge status="待接受" size={18} />
            </div>
            <h5 className="text-[13px] font-semibold text-slate-900 leading-snug">{action.title}</h5>
            {action.expectation && (
              <div className="mt-2 flex items-start gap-1.5">
                <span className="shrink-0 text-[10px] text-slate-400 mt-px w-7">预期</span>
                <p className="flex-1 text-[11px] text-slate-600 leading-snug line-clamp-2">{action.expectation}</p>
              </div>
            )}
            <div className="max-h-0 opacity-0 group-hover/action:max-h-[180px] group-hover/action:opacity-100 overflow-hidden transition-all duration-200">
              <div className="mt-2 pt-2 border-t border-slate-200/70 space-y-1.5 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5"><User size={11} /> 负责人：<span className="text-slate-700">{action.assignee || "待指派"}</span></div>
                <div className="flex items-center gap-1.5"><span className="text-slate-400">部门：</span>{action.department}</div>
                {action.dueDate && <div className="flex items-center gap-1.5"><Calendar size={11} /> 预期完成：{action.dueDate}</div>}
                {(action.attachments?.length || action.voiceNote) && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {action.attachments && action.attachments.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 bg-white" title={action.attachments.map((item) => item.name).join("、")}>
                        附件 {action.attachments.length}
                      </span>
                    )}
                    {action.voiceNote && <VoicePlayer src={action.voiceNote} />}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border-2 border-[#0052D9] rounded-xl p-3.5 shadow-xl max-h-[78vh] overflow-y-auto">
          <div className="space-y-2.5">
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
                  onChange={(e) => setActionForm?.({ ...actionForm, urgency: e.target.value as Urgency })}
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
                    const newAssignee = e.target.value;
                    const newDepartment = ownerToDepartment[newAssignee] || actionForm?.department || "PTE";
                    setActionForm?.({ ...actionForm, assignee: newAssignee, department: newDepartment });
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
                  onChange={(voiceNote) => setActionForm?.({ ...actionForm, voiceNote })}
                  compact
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={onSave}
                className="flex-1 h-7 rounded bg-[#0052D9] text-white text-xs hover:bg-[#003FA8]"
              >
                确认
              </button>
              <button
                onClick={onCancel}
                className="flex-1 h-7 rounded border border-slate-200 text-slate-600 text-xs hover:bg-slate-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


