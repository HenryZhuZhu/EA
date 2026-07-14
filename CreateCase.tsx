import React, { useMemo, useState } from "react";
import {
  Lightbulb,
  Shield,
  Sparkles,
  Plus,
  User,
  Network,
  Check,
  Search,
  X as XIcon,
  Users,
  Globe,
  Edit2,
  Trash2,
  Calendar,
  RotateCcw,
  HelpCircle,
  Fingerprint,
  MousePointerClick,
  ChevronLeft,
  Cpu,
  ClipboardList,
  ExternalLink,
  Wand2,
  Loader2,
  ClipboardPaste,
} from "lucide-react";
import {
  departments,
  mockCases,
  levelColors,
  currentUser,
  CaseItem,
  TaskNode,
  Urgency,
  Level,
  ownerToDepartment,
  mockProducts,
  productById,
  IssueSource,
  issueStatusColors,
  objectTypeColors,
  OBJECT_TYPES,
} from "./data";
import { createManualCase, aggregateCase, createIssue, useIssues, linkChildren } from "./domainStore";
import { AIPolishButton } from "./AIPolishButton";
import { VoiceInputButton } from "./VoiceInputButton";
import { AttachmentInput, Att } from "./AttachmentInput";
import { PersonInput } from "./PersonInput";
import { CreateCaseMindMapFlow } from "./CreateCaseMindMapFlow";
import { CaseProductPill } from "./CaseProductPill";

export type CreateCaseMode =
  | "create"
  | "upgrade"
  | "approve"
  | "edit";

interface Props {
  onDone: () => void;
  mode?: CreateCaseMode;
  initialCase?: CaseItem;
  onCreated?: (caseId: string) => void;
}

const CASE_SOURCES: IssueSource[] = ["手动", "Q·FAQA", "MC·WBS", "SC·FAE"];
const ISSUE_STATUS_OPTS = ["未定位", "调查中", "已定位", "已解决"];

const urgencies: Urgency[] = [
  "非常紧急",
  "紧急",
  "一般",
  "不紧急",
];

// R08：权限设置本地记忆
type PermPreset = { type: "all" | "partial"; list: Array<{ id: string; name: string; type: "user" | "dept" }> };
const PERM_KEY = "ea_perm_preset_v1";
function loadPermPreset(): PermPreset | null {
  try {
    const raw = localStorage.getItem(PERM_KEY);
    return raw ? (JSON.parse(raw) as PermPreset) : null;
  } catch {
    return null;
  }
}
function savePermPreset(p: PermPreset) {
  try {
    localStorage.setItem(PERM_KEY, JSON.stringify(p));
  } catch {}
}

export function CreateCase({
  onDone,
  mode = "create",
  initialCase,
  onCreated,
}: Props) {
  // Core fields
  const [name, setName] = useState(initialCase?.name ?? "");
  const [reason, setReason] = useState(
    initialCase?.reason ?? "",
  );
  const [background, setBackground] = useState(
    initialCase?.background ?? "",
  );
  const [impact, setImpact] = useState(
    initialCase?.impact ?? "",
  );
  const [caseAttachments, setCaseAttachments] = useState<Att[]>(
    initialCase?.caseAttachments ?? [],
  );
  const [levelReason, setLevelReason] = useState(
    initialCase?.levelReason ?? "",
  );
  const [level, setLevel] = useState<Level>(
    (initialCase?.level as Level) ?? "L5",
  );
  const [urgency, setUrgency] = useState<Urgency>(
    (initialCase?.urgency as Urgency) ?? "一般",
  );
  const [caseOwner, setCaseOwner] = useState(
    initialCase?.owner ?? currentUser.name,
  );
  const [dueDate, setDueDate] = useState("");

  // V1.0.3：来源 + 归属 Issue（人工立案）
  const [source, setSource] = useState<IssueSource>((initialCase?.source as IssueSource) ?? "手动");
  const [attachIssueIds, setAttachIssueIds] = useState<string[]>([]);
  const [newIssueName, setNewIssueName] = useState("");
  const [issueLinkMode, setIssueLinkMode] = useState<"later" | "now">("later");
  const allIssues = useIssues();
  // 归属 Issue 查找 / 过滤（具体过滤项待定，当前：搜索 + objectType + 状态）
  const [issueQ, setIssueQ] = useState("");
  const [issueObjType, setIssueObjType] = useState("全部");
  const [issueStatusF, setIssueStatusF] = useState("全部");
  const filteredIssues = allIssues.filter((iss) => {
    if (issueObjType !== "全部" && iss.objectType !== issueObjType) return false;
    if (issueStatusF !== "全部" && iss.status !== issueStatusF) return false;
    if (issueQ.trim() && ![iss.code, iss.name].join(" ").toLowerCase().includes(issueQ.trim().toLowerCase())) return false;
    return true;
  });

  // Extended basic info (formerly the "expand 全部创建信息" section)
  const [product, setProduct] = useState(
    initialCase?.product ?? "",
  );
  const [material, setMaterial] = useState(
    initialCase?.material ?? "",
  );
  const [density, setDensity] = useState(
    initialCase?.density ?? "",
  );
  const [ioType, setIoType] = useState(
    initialCase?.ioType ?? "",
  );
  const [failStage, setFailStage] = useState(
    initialCase?.failStage ?? "",
  );
  const [customer, setCustomer] = useState(
    initialCase?.customer ?? "",
  );
  const [failPlatform, setFailPlatform] = useState(
    initialCase?.failPlatform ?? "",
  );
  const [failMode, setFailMode] = useState(
    initialCase?.failMode ?? "",
  );
  const [ppm, setPpm] = useState(initialCase?.ppm ?? "");
  const [pdId, setPdId] = useState(initialCase?.pdId ?? "");

  // IC / DIMM / lot/wafer extra fields
  const [failRatio, setFailRatio] = useState("");
  const [maskVersion, setMaskVersion] = useState("");
  const [failPackage, setFailPackage] = useState("");
  const [program, setProgram] = useState("");

  // lot/wafer grain list
  interface LotGrain {
    id: string;
    lotId: string;
    waferId: string;
    chipId: string;
    failMode: string;
    failCondition: string;
  }
  const [lotGrains, setLotGrains] = useState<LotGrain[]>([
    { id: crypto.randomUUID(), lotId: "", waferId: "", chipId: "", failMode: "", failCondition: "" },
  ]);

  const updateLotGrain = (id: string, field: keyof Omit<LotGrain, "id">, value: string) => {
    setLotGrains(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const addLotGrain = () => {
    setLotGrains(prev => [
      ...prev,
      { id: crypto.randomUUID(), lotId: "", waferId: "", chipId: "", failMode: "", failCondition: "" },
    ]);
  };

  const removeLotGrain = (id: string) => {
    setLotGrains(prev => prev.filter(g => g.id !== id));
  };

  const getLotMarkCode = (g: LotGrain) => {
    const filled = [g.lotId, g.waferId, g.chipId, g.failMode, g.failCondition].every(v => v.trim() !== "");
    if (!filled) return "—";
    return `MC-${g.lotId.slice(-3).toUpperCase()}-${g.waferId.slice(-3).toUpperCase()}-${g.chipId.slice(-3).toUpperCase()}-${g.failMode.slice(0, 2).toUpperCase()}-${g.failCondition.slice(0, 2).toUpperCase()}`;
  };

  // DIMM grain list
  interface DimmGrain {
    id: string;
    sn: string;
    workOrder: string;
    failMode: string;
    failCondition: string;
    failedIcs: string;
    failedIcInfo: Record<string, { barcode: string; chipid: string; failMode: string; failCondition: string }>;
  }
  const [dimmGrains, setDimmGrains] = useState<DimmGrain[]>([
    { id: crypto.randomUUID(), sn: "", workOrder: "", failMode: "", failCondition: "", failedIcs: "", failedIcInfo: {} },
  ]);

  const updateDimmGrain = (id: string, field: keyof Omit<DimmGrain, "id">, value: string) => {
    setDimmGrains(prev =>
      prev.map(g => g.id === id ? { ...g, [field]: value } : g)
    );
  };

  const addDimmGrain = () => {
    setDimmGrains(prev => [
      ...prev,
      { id: crypto.randomUUID(), sn: "", workOrder: "", failMode: "", failCondition: "", failedIcs: "", failedIcInfo: {} },
    ]);
  };

  const removeDimmGrain = (id: string) => {
    setDimmGrains(prev => prev.filter(g => g.id !== id));
  };

  const parseDimmFailedIcs = (raw: string) => {
    return [...new Set(
      raw
        .split(/[,，、\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    )];
  };

  const getDimmMarkCode = (g: DimmGrain) => {
    const filled = [g.sn, g.workOrder, g.failMode, g.failCondition].every(v => v.trim() !== "") && parseDimmFailedIcs(g.failedIcs).length > 0;
    if (!filled) return "—";
    return `MC-${g.sn.slice(-4).toUpperCase()}-${g.workOrder.slice(-4).toUpperCase()}-${g.failMode.slice(0, 3).toUpperCase()}-${g.failCondition.slice(0, 3).toUpperCase()}`;
  };

  // DIMM 板卡示意：左右两个 rank，每 rank 4 颗，点击标记失效颗粒
  const DIMM_IC_POSITIONS = ["U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8"];
  const toggleDimmFailedIc = (id: string, code: string) => {
    setDimmGrains(prev => prev.map(g => {
      if (g.id !== id) return g;
      const set = new Set(parseDimmFailedIcs(g.failedIcs));
      const info = { ...(g.failedIcInfo || {}) };
      if (set.has(code)) {
        set.delete(code);
        delete info[code];
      } else {
        set.add(code);
        if (!info[code]) info[code] = { barcode: "", chipid: "", failMode: "", failCondition: "" };
      }
      const ordered = DIMM_IC_POSITIONS.filter(p => set.has(p));
      return { ...g, failedIcs: ordered.join(","), failedIcInfo: info };
    }));
  };
  const updateDimmFailedIcInfo = (id: string, code: string, field: "barcode" | "chipid" | "failMode" | "failCondition", value: string) => {
    setDimmGrains(prev => prev.map(g => {
      if (g.id !== id) return g;
      const info = { ...(g.failedIcInfo || {}) };
      info[code] = { ...(info[code] || { barcode: "", chipid: "", failMode: "", failCondition: "" }), [field]: value };
      return { ...g, failedIcInfo: info };
    }));
  };

  // IC grain list
  interface IcGrain {
    id: string;
    barcode: string;
    chipid: string;
    failMode: string;
    failCondition: string;
  }
  const [icGrains, setIcGrains] = useState<IcGrain[]>([
    { id: crypto.randomUUID(), barcode: "", chipid: "", failMode: "", failCondition: "" },
  ]);

  const updateIcGrain = (id: string, field: keyof Omit<IcGrain, "id">, value: string) => {
    setIcGrains(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const addIcGrain = () => {
    setIcGrains(prev => [
      ...prev,
      { id: crypto.randomUUID(), barcode: "", chipid: "", failMode: "", failCondition: "" },
    ]);
  };

  const removeIcGrain = (id: string) => {
    setIcGrains(prev => prev.filter(g => g.id !== id));
  };

  const getIcMarkCode = (g: IcGrain) => {
    const filled = [g.barcode, g.chipid, g.failMode, g.failCondition].every(v => v.trim() !== "");
    if (!filled) return "—";
    return `MC-${g.barcode.slice(-4).toUpperCase()}-${g.chipid.slice(-4).toUpperCase()}-${g.failMode.slice(0, 3).toUpperCase()}-${g.failCondition.slice(0, 3).toUpperCase()}`;
  };

  // 查看 Chip DNA / One Click：在新建页内打开对应的全屏页面（保留新建表单状态）
  const [viewer, setViewer] = useState<null | { kind: "chipdna" | "oneclick"; mark: string; title: string; rows: { k: string; v: string }[] }>(null);
  const icRows = (g: IcGrain) => [
    { k: "Mark Code", v: getIcMarkCode(g) },
    { k: "Barcode", v: g.barcode || "—" },
    { k: "Chip ID", v: g.chipid || "—" },
    { k: "Fail Mode", v: g.failMode || "—" },
    { k: "Fail Condition", v: g.failCondition || "—" },
  ];
  const lotRows = (g: LotGrain) => [
    { k: "Mark Code", v: getLotMarkCode(g) },
    { k: "Lot ID", v: g.lotId || "—" },
    { k: "Wafer ID", v: g.waferId || "—" },
    { k: "Chip ID", v: g.chipId || "—" },
    { k: "Fail Mode", v: g.failMode || "—" },
    { k: "Fail Condition", v: g.failCondition || "—" },
  ];
  const openChipDNA = (mark: string, rows: { k: string; v: string }[]) => setViewer({ kind: "chipdna", mark, title: mark === "—" ? "未填写完整" : mark, rows });
  const openOneClick = (mark: string, rows: { k: string; v: string }[]) => setViewer({ kind: "oneclick", mark, title: mark === "—" ? "未填写完整" : mark, rows });

  // Tasks tree
  const [tasks, setTasks] = useState<TaskNode[]>(
    initialCase?.tasks ?? [],
  );

  // Permission settings — R08：新建时记住上次设置（仅 create 模式预填）
  const savedPerm = mode === "create" ? loadPermPreset() : null;
  const [permissionType, setPermissionType] = useState<
    "all" | "partial"
  >(savedPerm?.type ?? "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [permissionList, setPermissionList] = useState<
    Array<{ id: string; name: string; type: "user" | "dept" }>
  >(savedPerm?.list ?? []);

  // Mind map groups for create mode - Tree structure
  const [thoughtGroups, setThoughtGroups] = useState<
    ThoughtGroup[]
  >([]);

  // —— 功能1：AI 智能识别填充（演示）——
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<null | AiField[]>(null);
  const [aiPicked, setAiPicked] = useState<Record<string, boolean>>({});

  // —— 功能2：DIMM 按颗粒拆分为子 Case（演示）——
  const [dimmSplitOpen, setDimmSplitOpen] = useState(false);
  const [dimmSplitDone, setDimmSplitDone] = useState(false);
  const [dimmSplitSel, setDimmSplitSel] = useState<Record<string, boolean>>({});
  const [dimmSplitMerge, setDimmSplitMerge] = useState(false);
  const dimmSplittable = dimmGrains.filter((g) => g.sn.trim() && g.failMode.trim());
  const dimmSplitGroups: { label: string; grains: typeof dimmGrains }[] = (() => {
    const gs = dimmSplittable.filter((g) => dimmSplitSel[g.id]);
    if (!dimmSplitMerge) return gs.map((g) => ({ label: g.failMode || "DIMM", grains: [g] }));
    const m = new Map<string, typeof dimmGrains>();
    gs.forEach((g) => { const k = g.failMode || "未分类"; if (!m.has(k)) m.set(k, [] as any); (m.get(k) as any).push(g); });
    return [...m.entries()].map(([label, grains]) => ({ label, grains }));
  })();

  // —— IC / lot·wafer 拆解为多个独立 Case（可选）——
  const [icSplit, setIcSplit] = useState(false);
  const [lotSplit, setLotSplit] = useState(false);
  const [icSplitSel, setIcSplitSel] = useState<Record<string, boolean>>({});
  const [lotSplitSel, setLotSplitSel] = useState<Record<string, boolean>>({});
  const [materialSplitOpen, setMaterialSplitOpen] = useState(false);
  const icSplittable = icGrains.filter((g) => getIcMarkCode(g) !== "—");
  const lotSplittable = lotGrains.filter((g) => getLotMarkCode(g) !== "—");
  const icSelected = icSplittable.filter((g) => !!icSplitSel[g.id]);
  const lotSelected = lotSplittable.filter((g) => !!lotSplitSel[g.id]);

  const AI_SAMPLE = "客户：北美 A 客户 反馈 DMJFC 产品在 FT 高温段出现批量 Icc 漏电超规，失效比例约 0.8%，密度 16Gb，封装 FBGA，IO x8，平台 X86。当前已影响 3 个 Lot 的交付，存在退货风险，PPM 约 1200。请尽快定位根因，紧急，建议按 L2 处理。物料为 DIMM。";

  const runAiParse = () => {
    if (!aiText.trim()) return;
    setAiBusy(true);
    setAiResult(null);
    // 演示：模拟 AI 识别延迟
    setTimeout(() => {
      const fields = parseCaseDescription(aiText);
      const picked: Record<string, boolean> = {};
      fields.forEach((f) => (picked[f.key] = true));
      setAiResult(fields);
      setAiPicked(picked);
      setAiBusy(false);
    }, 700);
  };

  const applyAiFields = () => {
    if (!aiResult) return;
    const set: Record<string, (v: string) => void> = {
      name: setName, background: setBackground, impact: setImpact, product: setProduct,
      material: setMaterial, density: setDensity, ioType: setIoType, failStage: setFailStage,
      customer: setCustomer, failPlatform: setFailPlatform, failMode: setFailMode,
      failRatio: setFailRatio, failPackage: setFailPackage, ppm: setPpm,
      level: (v) => setLevel(v as Level), urgency: (v) => setUrgency(v as Urgency),
    };
    aiResult.forEach((f) => {
      if (aiPicked[f.key] && set[f.key]) set[f.key](f.value);
    });
    setAiOpen(false);
    setAiResult(null);
    setAiText("");
  };

  // Synthesized CaseItem for the shared MindMap to render against
  const synthesizedCase: CaseItem = useMemo(() => {
    const base = (initialCase ?? mockCases[0]) as CaseItem;
    return {
      ...base,
      id: initialCase?.id ?? "__draft__",
      code: initialCase?.code ?? "DRAFT-NEW",
      name: name || "（未命名 Case）",
      owner: caseOwner,
      level,
      urgency,
      reason,
      background,
      impact,
      caseAttachments,
      levelReason,
      product,
      material,
      density,
      ioType,
      failStage,
      customer,
      failPlatform,
      failMode,
      ppm,
      pdId,
      tasks,
      departments: Array.from(
        new Set(tasks.map((t) => t.department).filter(Boolean)),
      ),
    } as CaseItem;
  }, [
    initialCase,
    name,
    caseOwner,
    level,
    urgency,
    reason,
    background,
    impact,
    caseAttachments,
    levelReason,
    product,
    material,
    density,
    ioType,
    failStage,
    customer,
    failPlatform,
    failMode,
    ppm,
    pdId,
    tasks,
  ]);

  const insertTask = (parentId: string | null, t: TaskNode) => {
    if (parentId === null) {
      setTasks([...tasks, t]);
      return;
    }
    const insert = (nodes: TaskNode[]): TaskNode[] =>
      nodes.map((n) =>
        n.id === parentId
          ? { ...n, children: [...(n.children ?? []), t] }
          : {
              ...n,
              children: n.children
                ? insert(n.children)
                : n.children,
            },
      );
    setTasks(insert(tasks));
  };

  const submitTask = (
    parentId: string | null,
    p: AddTaskPayload,
  ) => {
    insertTask(parentId, {
      id: `t${Date.now()}`,
      title: p.title,
      owner: p.assignee.trim() || "待指派",
      department: p.department,
      urgency: p.urgency,
      progress: 0,
      status: "待接受",
      dueDate: p.dueDate || undefined,
      type: p.type,
      note: p.note,
      supervisor: p.supervisor,
      site: p.site,
    });
  };

  const editTask = (id: string, p: AddTaskPayload) => {
    const apply = (nodes: TaskNode[]): TaskNode[] =>
      nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              title: p.title,
              owner: p.assignee.trim() || n.owner,
              department: p.department || n.department,
              urgency: p.urgency,
              dueDate: p.dueDate || n.dueDate,
              type: p.type ?? n.type,
              note: p.note ?? n.note,
              supervisor: p.supervisor ?? n.supervisor,
              site: p.site ?? n.site,
            }
          : {
              ...n,
              children: n.children
                ? apply(n.children)
                : n.children,
            },
      );
    setTasks(apply(tasks));
  };

  const deleteTask = (id: string) => {
    const remove = (nodes: TaskNode[]): TaskNode[] =>
      nodes
        .filter((n) => n.id !== id)
        .map((n) => ({
          ...n,
          children: n.children
            ? remove(n.children)
            : n.children,
        }));
    setTasks(remove(tasks));
  };

  const pageLabel =
    mode === "upgrade"
      ? "Case 升级"
      : mode === "approve"
        ? "审批 · Case 复核"
        : mode === "edit"
          ? "编辑 Case"
          : "新建 Case";
  const submitLabel =
    mode === "upgrade"
      ? "提交升级申请"
      : mode === "approve"
        ? "确定"
        : mode === "edit"
          ? "确定"
          : "确定";
  const heroHint =
    mode === "upgrade"
      ? `当前 Case：${initialCase?.code ?? ""} · 原层级 ${initialCase?.level ?? "—"}。请确认基础信息并重新拆解、分派任务。`
      : mode === "approve"
        ? `审批中：${initialCase?.code ?? ""}。可直接修改 Case 背景、负责人及任务分派。`
        : mode === "edit"
          ? `编辑 Case：${initialCase?.code ?? ""}。可修改 Case 基础信息、任务分派及思维导图。`
          : "先填写 Case 信息，再以思维导图的形式拆解任务。";

  const suggested =
    name.length > 2
      ? mockCases
          .filter(
            (c) =>
              c.name.includes(name[0]) ||
              c.product.includes(name[0]),
          )
          .slice(0, 2)
      : [];

  const canSubmit = name.trim() && dueDate && background.trim() && impact.trim() && level && urgency;

  // 人工立案提交：持久化 Case → 关联/新建 Issue → 打开新 Case
  const finalSubmit = () => {
    savePermPreset({ type: permissionType, list: permissionList });
    if (mode === "create") {
      const base = {
        name: name.trim(), owner: caseOwner, level, urgency,
        reason: reason || background, background, impact, levelReason,
        product, material, density, ioType, failStage, customer, failPlatform, failMode, ppm, pdId,
        source, tasks, caseAttachments,
      };
      let primaryId: string;

      if (material === "DIMM" && dimmSplitDone && dimmSplitGroups.length > 0) {
        // DIMM → 1 个 DIMM 父 Case + N 个子 Case
        const parent = createManualCase(base);
        const childIds = dimmSplitGroups.map((grp) => {
          const g = grp.grains[0];
          return createManualCase({
            ...base,
            name: `${name.trim()} · ${grp.label}`,
            failMode: g.failMode || failMode,
            parentCaseId: parent.id,
            splitGranule: { markCode: getDimmMarkCode(g), sn: g.sn, failMode: g.failMode, failCondition: g.failCondition, failedIcs: g.failedIcs },
          }).id;
        });
        linkChildren(parent.id, childIds);
        primaryId = parent.id;
      } else if (material === "IC" && icSplit && icSelected.length > 0) {
        // IC → N 个独立 Case
        const ids = icSelected.map((g) => createManualCase({
          ...base,
          name: icSelected.length > 1 ? `${name.trim()} · ${getIcMarkCode(g)}` : name.trim(),
          failMode: g.failMode || failMode,
          splitGranule: { markCode: getIcMarkCode(g), sn: g.barcode, failMode: g.failMode, failCondition: g.failCondition },
        }).id);
        primaryId = ids[0];
      } else if (material === "lot/wafer" && lotSplit && lotSelected.length > 0) {
        // lot/wafer → N 个独立 Case
        const ids = lotSelected.map((g) => createManualCase({
          ...base,
          name: lotSelected.length > 1 ? `${name.trim()} · ${getLotMarkCode(g)}` : name.trim(),
          failMode: g.failMode || failMode,
          splitGranule: { markCode: getLotMarkCode(g), sn: g.lotId, failMode: g.failMode, failCondition: g.failCondition },
        }).id);
        primaryId = ids[0];
      } else {
        primaryId = createManualCase(base).id;
      }

      attachIssueIds.forEach((iid) => aggregateCase(iid, primaryId));
      if (newIssueName.trim()) {
        createIssue({ name: newIssueName.trim(), source, objectType: productById(product)?.objectType ?? "IC", caseIds: [primaryId] });
      }
      if (onCreated) onCreated(primaryId); else onDone();
      return;
    }
    onDone();
  };

  const handleReset = () => {
    setName(initialCase?.name ?? "");
    setReason(initialCase?.reason ?? "");
    setBackground(initialCase?.background ?? "");
    setImpact(initialCase?.impact ?? "");
    setLevelReason(initialCase?.levelReason ?? "");
    setLevel((initialCase?.level as Level) ?? "L5");
    setUrgency((initialCase?.urgency as Urgency) ?? "一般");
    setCaseOwner(initialCase?.owner ?? currentUser.name);
    setDueDate("");
    setProduct(initialCase?.product ?? "");
    setMaterial(initialCase?.material ?? "");
    setMaterialSplitOpen(false);
    setDensity(initialCase?.density ?? "");
    setIoType(initialCase?.ioType ?? "");
    setFailStage(initialCase?.failStage ?? "");
    setCustomer(initialCase?.customer ?? "");
    setFailPlatform(initialCase?.failPlatform ?? "");
    setFailMode(initialCase?.failMode ?? "");
    setPpm(initialCase?.ppm ?? "");
    setPdId(initialCase?.pdId ?? "");
    setTasks(initialCase?.tasks ?? []);
    setPermissionType("all");
    setSearchQuery("");
    setPermissionList([]);
    setThoughtGroups([]);
    setIcSplit(false);
    setLotSplit(false);
    setIcSplitSel({});
    setLotSplitSel({});
    setDimmSplitDone(false);
    setDimmSplitOpen(false);
  };

  // 「查看 Chip DNA / One Click」对应的独立页面（在新建页内跳转，返回不丢失表单）
  if (viewer) {
    const isDNA = viewer.kind === "chipdna";
    const accent = "#0052D9";
    const Icon = isDNA ? Fingerprint : MousePointerClick;
    return (
      <div className="relative min-h-full">
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 80% 50% at 0% 0%, ${accent}0d, transparent 60%)` }} />
        <div className="relative p-8 max-w-[1100px] mx-auto space-y-6">
          {/* 顶部：返回 + 标题 */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setViewer(null)}
              className="h-9 px-3 rounded-md border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <ChevronLeft size={15} /> 返回新建 Case
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-500">{isDNA ? "Chip DNA 溯源" : "One Click 一键分析"}</span>
          </div>

          {/* Hero */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}55)` }} />
            <div className="p-6 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl grid place-items-center text-white shrink-0" style={{ background: accent }}>
                <Icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[20px] font-bold text-slate-900 tracking-tight">{isDNA ? "Chip DNA 溯源" : "One Click 一键分析"}</h2>
                  <span className="text-[11px] px-2 py-0.5 rounded-full border" style={{ color: accent, borderColor: `${accent}40`, background: `${accent}0d` }}>{isDNA ? "全链路履历" : "自动失效分析"}</span>
                </div>
                <div className="text-[12.5px] text-slate-500 mt-1.5">
                  Mark Code <span className="font-mono" style={{ color: accent }}>{viewer.title}</span> · 数据来源于 {isDNA ? "Chip DNA 系统" : "One Click 平台"}（演示数据）
                </div>
              </div>
              <button type="button" className="h-9 px-3 rounded-md text-sm text-white flex items-center gap-1.5 shrink-0 hover:opacity-90" style={{ background: accent }}>
                <ExternalLink size={14} /> 在{isDNA ? "Chip DNA" : "One Click"}系统中打开
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-5 items-start">
            {/* 左：颗粒信息卡 */}
            <div className="rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="px-4 h-11 flex items-center gap-2 border-b border-slate-100">
                <Cpu size={14} className="text-slate-400" />
                <span className="text-[13px] font-bold text-slate-800">失效单元信息</span>
              </div>
              <div className="divide-y divide-slate-50">
                {viewer.rows.map((r) => (
                  <div key={r.k} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="text-[12px] text-slate-400 w-[92px] shrink-0">{r.k}</span>
                    <span className="text-[12.5px] text-slate-800 font-mono truncate">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 右：对应页面主体（演示占位） */}
            <div className="space-y-5 min-w-0">
              {isDNA ? (
                <div className="rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] overflow-hidden">
                  <div className="px-4 h-11 flex items-center gap-2 border-b border-slate-100">
                    <Fingerprint size={14} style={{ color: accent }} />
                    <span className="text-[13px] font-bold text-slate-800">制造履历溯源</span>
                  </div>
                  <div className="p-5">
                    <div className="relative pl-5">
                      <div className="absolute left-[6px] top-1.5 bottom-1.5 w-px bg-slate-100" />
                      <div className="space-y-4">
                        {[
                          { s: "晶圆制造 (FAB)", d: "Lot 投片 · Mask 版本核对 · 关键工艺参数留痕" },
                          { s: "晶圆测试 (CP)", d: "CP1 / CP2 bin map · 同 Wafer 邻位失效分布" },
                          { s: "封装 (Assembly)", d: "封装批次 · 引线 / 基板批号 · X-ray 抽检记录" },
                          { s: "成品测试 (FT)", d: "FT bin 履历 · Retest 记录 · 测试程序版本" },
                          { s: "出货 / 客户", d: "出货批次 · 客户端失效回溯与退货关联" },
                        ].map((n) => (
                          <div key={n.s} className="relative">
                            <span className="absolute -left-[18px] top-1 w-2.5 h-2.5 rounded-full ring-2 ring-white" style={{ background: accent }} />
                            <div className="text-[13px] font-semibold text-slate-800">{n.s}</div>
                            <div className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">{n.d}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { k: "失效复现", v: "已复现", t: "#16a34a" },
                      { k: "疑似根因", v: "PKG 内引线偏移", t: accent },
                      { k: "置信度", v: "82%", t: "#d97706" },
                    ].map((c) => (
                      <div key={c.k} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
                        <div className="text-[12px] text-slate-400">{c.k}</div>
                        <div className="text-[16px] font-bold mt-1.5 truncate" style={{ color: c.t }}>{c.v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] overflow-hidden">
                    <div className="px-4 h-11 flex items-center gap-2 border-b border-slate-100">
                      <MousePointerClick size={14} style={{ color: accent }} />
                      <span className="text-[13px] font-bold text-slate-800">一键分析报告</span>
                    </div>
                    <div className="p-5 space-y-3">
                      {[
                        "自动归集该单元 CP / FT / 客户端测试数据，定位失效 bin 与异常 pattern。",
                        "比对同 Lot / 邻位 Wafer 失效分布，判断是否为批次性 / 区域性失效。",
                        "关联 Chip DNA 制造履历，输出疑似根因与下一步验证建议。",
                      ].map((t, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-[13px] text-slate-600 leading-relaxed">
                          <span className="mt-0.5 w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold shrink-0 text-white" style={{ background: accent }}>{i + 1}</span>
                          <span>{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <p className="text-xs text-slate-400">以上为演示页面占位，正式版将对接 {isDNA ? "Chip DNA" : "One Click"} 系统的真实数据。</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_0%_0%,rgba(0,82,217,0.05),transparent_60%)]" />

      <div className="relative p-8 pb-28 max-w-[1200px] mx-auto space-y-6">
        {/* Hero */}
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            {mode !== "create" && (
              <div className="flex items-center gap-2 text-xs text-slate-500 tracking-wider uppercase">
                <Sparkles size={12} className="text-[#0052D9]" />
                {mode === "upgrade"
                  ? "Case Upgrade · 重新拆解"
                  : mode === "approve"
                    ? "Case Approval · 复核修改"
                    : "Edit Case · 编辑信息"}
              </div>
            )}
            <h1 className="text-slate-900 tracking-tight">
              {pageLabel}
            </h1>
            <p className="text-sm text-slate-500 max-w-xl leading-relaxed">
              {heroHint}
            </p>
          </div>
        </div>
        {mode !== "create" && (
          <div className="text-[11px] text-slate-500 bg-[#0052D9]/5 border border-[#0052D9]/20 rounded-md px-3 py-2 flex items-center gap-2 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0052D9]" />
            {mode === "upgrade"
              ? "升级申请将发送至新层级对应的审批人（L1/L2 → PEL，L3/L4 → 部门主管）。"
              : mode === "approve"
                ? "审批通过后将以此版本覆盖原 Case，并通知所有被分派人。"
                : "保存后将更新 Case 信息，已分派的任务负责人将收到通知。"}
          </div>
        )}

        {/* Section 1: Basic info */}
        <section className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#0052D9]/8 text-[#0052D9] flex items-center justify-center text-[11px]">
              1
            </div>
            <h3 className="text-slate-900">Case 信息</h3>
          </div>
          <div className="p-5 space-y-5">

            {/* ===== 两栏：基础 + 背景 ===== */}
            <div className="grid grid-cols-2 gap-6 items-stretch">

            {/* ===== 基础 ===== */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList size={13} className="text-[#0052D9]" />
                <span className="text-xs font-semibold text-slate-700">基础</span>
              </div>
              <div className="space-y-4">
            <Field label="Case 名称" required>
              <div className="relative">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="输入关键词，系统将联想历史/进行中相似 Case 以避免重复"
                  className="w-full h-10 pl-3 pr-20 rounded-md border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-[#0052D9] outline-none text-sm"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <VoiceInputButton
                    size="sm"
                    onTranscript={(t) => setName((p) => (p ? p + " " + t : t))}
                  />
                  <AIPolishButton
                    size="sm"
                    getText={() => name}
                    onPolished={(t) => setName(t)}
                    hint="AI 润色 Case 名称"
                  />
                </div>
              </div>
              {suggested.length > 0 && (
                <div className="mt-2 bg-amber-50/70 border border-amber-200 rounded-md p-3">
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 mb-2">
                    <Lightbulb size={12} /> 发现相似
                    Case，建议合并以免重复：
                  </div>
                  <div className="space-y-1.5">
                    {suggested.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] border ${levelColors[s.level]}`}
                        >
                          {s.level}
                        </span>
                        <CaseProductPill caseItem={s} compact />
                        <span className="flex-1 text-slate-800 truncate">
                          {s.name}
                        </span>
                        <button className="text-xs text-[#0052D9] hover:underline">
                          合并到此 Case
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Case Owner（负责人）" required>
                <PersonInput
                  value={caseOwner}
                  onChange={setCaseOwner}
                  placeholder="@ 选择负责人"
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-[#0052D9] outline-none text-sm"
                />
              </Field>
              <Field label="层级" required labelExtra={
                <div className="relative group inline-flex ml-1">
                  <HelpCircle size={12} className="text-slate-400 cursor-help" />
                  <div className="absolute bottom-full right-0 mb-1.5 w-72 bg-slate-800 text-white text-[11px] rounded-md px-3 py-2.5 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg space-y-1">
                    <div className="text-slate-300 mb-1">层级 = 问题重要性与影响范围，决定审批层级与响应时效：</div>
                    <div><b className="text-red-300">L1</b> 公司级 / 客户重大：VP 审批，最高优先，需即时响应</div>
                    <div><b className="text-orange-300">L2</b> 跨三级部门 / 客户预警：总监审批，当日响应</div>
                    <div><b className="text-amber-300">L3</b> 跨部门协同：PEL / 主管审批</div>
                    <div><b className="text-blue-300">L4</b> 单部门内、影响有限</div>
                    <div><b className="text-slate-300">L5</b> 部门内常规 / 优化建议</div>
                    <div className="text-slate-400 pt-0.5">默认取参与人员所属部门的最高层级，可手动上调。</div>
                    <div className="absolute top-full right-2 border-4 border-transparent border-t-slate-800" />
                  </div>
                </div>
              }>
                <div className="flex gap-1">
                  {(
                    ["L1", "L2", "L3", "L4", "L5"] as Level[]
                  ).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLevel(l)}
                      className={`h-10 flex-1 rounded-md border text-xs transition-all ${
                        level === l
                          ? "bg-[#0052D9] text-white border-[#0052D9] shadow-sm"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="紧急程度" required>
                <div className="flex gap-1">
                  {urgencies.map((u) => (
                    <button
                      key={u}
                      onClick={() => setUrgency(u)}
                      className={`h-10 flex-1 rounded-md border text-[11px] transition-all ${
                        urgency === u
                          ? "bg-[#0052D9] text-white border-[#0052D9] shadow-sm"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="截止日期" required>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-[#0052D9] outline-none text-sm"
                />
              </Field>
            </div>
            <Field label="可见范围">
              <div className="space-y-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => setPermissionType("all")}
                    className={`flex-1 h-10 rounded-md border flex items-center justify-center gap-2 text-sm transition-all ${
                      permissionType === "all"
                        ? "bg-[#0052D9]/8 border-[#0052D9] text-[#0052D9]"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Globe size={16} />
                    全员可见
                  </button>
                  <button
                    onClick={() => setPermissionType("partial")}
                    className={`flex-1 h-10 rounded-md border flex items-center justify-center gap-2 text-sm transition-all ${
                      permissionType === "partial"
                        ? "bg-[#0052D9]/8 border-[#0052D9] text-[#0052D9]"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Users size={16} />
                    部分人可见
                  </button>
                </div>

                {permissionType === "partial" && (
                  <div className="space-y-3 pt-2">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Search
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          value={searchQuery}
                          onChange={(e) =>
                            setSearchQuery(e.target.value)
                          }
                          placeholder="搜索人员或部门..."
                          className="w-full h-9 pl-9 pr-3 rounded-md border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-[#0052D9] outline-none text-sm"
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (searchQuery.trim()) {
                            const newItem = {
                              id: `perm-${Date.now()}`,
                              name: searchQuery.trim(),
                              type: searchQuery.includes("部")
                                ? ("dept" as const)
                                : ("user" as const),
                            };
                            setPermissionList([
                              ...permissionList,
                              newItem,
                            ]);
                            setSearchQuery("");
                          }
                        }}
                        disabled={!searchQuery.trim()}
                        className="h-9 px-4 rounded-md bg-[#0052D9] text-white text-sm hover:bg-[#003FA8] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        添加
                      </button>
                    </div>

                    {permissionList.length > 0 && (
                      <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-2">
                        <div className="text-xs text-slate-500 mb-2">
                          已添加 {permissionList.length}{" "}
                          个授权对象
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {permissionList.map((item) => (
                            <div
                              key={item.id}
                              className="inline-flex items-center gap-2 h-7 pl-2.5 pr-1.5 rounded-md bg-white border border-slate-200 text-sm"
                            >
                              {item.type === "dept" ? (
                                <Users
                                  size={12}
                                  className="text-[#0052D9]"
                                />
                              ) : (
                                <User
                                  size={12}
                                  className="text-[#0052D9]"
                                />
                              )}
                              <span className="text-slate-700">
                                {item.name}
                              </span>
                              <button
                                onClick={() => {
                                  setPermissionList(
                                    permissionList.filter(
                                      (p) => p.id !== item.id,
                                    ),
                                  );
                                }}
                                className="w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
                              >
                                <XIcon size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Field>
              </div>
            </div>

            {/* ===== 背景 ===== */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <Edit2 size={13} className="text-[#0052D9]" />
                <span className="text-xs font-semibold text-slate-700">背景</span>
              </div>
              <div className="flex-1 min-h-0 flex flex-col gap-4">
                {/* 背景.事由 */}
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="text-xs text-slate-600 mb-1.5 tracking-wide flex items-center">发生了什么？ <span className="text-red-500 ml-0.5">*</span></div>
                  <div className="relative flex-1 min-h-0">
                    <textarea
                      value={background}
                      onChange={(e) => setBackground(e.target.value)}
                      placeholder="范围 / 客户侧情况 / 已尝试措施..."
                      className="w-full h-full resize-none p-3 pr-28 rounded-md border border-slate-200 bg-slate-50/60 text-sm outline-none focus:bg-white focus:border-[#0052D9]"
                    />
                    <div className="absolute right-2 top-2 flex gap-1">
                      <VoiceInputButton size="sm" onTranscript={(t) => setBackground((p) => (p ? p + " " + t : t))} />
                      <AIPolishButton size="sm" getText={() => background} onPolished={(t) => setBackground(t)} />
                      <AttachmentInput variant="icon" value={caseAttachments} onChange={setCaseAttachments} />
                    </div>
                  </div>
                  <AttachmentInput variant="chips" value={caseAttachments} onChange={setCaseAttachments} />
                </div>
                {/* 影响 */}
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="text-xs text-slate-600 mb-1.5 tracking-wide flex items-center">带来什么影响？ <span className="text-red-500 ml-0.5">*</span></div>
                  <div className="relative flex-1 min-h-0">
                    <textarea
                      value={impact}
                      onChange={(e) => setImpact(e.target.value)}
                      placeholder="对良率 / 交付 / 客户 / 成本的影响，量化范围（如影响 Lot 数、PPM、停机时长等）..."
                      className="w-full h-full resize-none p-3 pr-20 rounded-md border border-slate-200 bg-slate-50/60 text-sm outline-none focus:bg-white focus:border-[#0052D9]"
                    />
                    <div className="absolute right-2 top-2 flex gap-1">
                      <VoiceInputButton size="sm" onTranscript={(t) => setImpact((p) => (p ? p + " " + t : t))} />
                      <AIPolishButton size="sm" getText={() => impact} onPolished={(t) => setImpact(t)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
            {/* ===== 两栏结束 ===== */}

            {/* ===== 产品信息 ===== */}
            <div className="pt-5 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Cpu size={13} className="text-[#0052D9]" />
                <span className="text-xs font-semibold text-slate-700">产品信息</span>
              </div>
              <div>
            {/* 影响 / 产品 / 物料 / 失效 */}
            <div className="pt-0">
              <div className="grid grid-cols-4 gap-3">
                {/* 产品编码 */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-500">
                    产品 <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={product}
                    onChange={e => setProduct(e.target.value)}
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:border-[#0052D9]"
                  >
                    <option value="">请选择</option>
                    {mockProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.code} · {p.objectType}</option>
                    ))}
                  </select>
                </div>
                {/* 案件物料 */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-500">
                    物料 <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-1">
                    {(["不适用", "lot/wafer", "IC", "DIMM"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setMaterial(m); setMaterialSplitOpen(false); }}
                        className={`h-8 flex-1 rounded-md border text-[11px] px-1 transition-all ${
                          material === m
                            ? "bg-[#0052D9] text-white border-[#0052D9] shadow-sm"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {m === "lot/wafer" ? "Lot/Wafer" : m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* IC / DIMM 专属字段（共8项） */}
                {(material === "IC" || material === "DIMM") && (
                  <>
                    {/* Fail Stage */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-slate-500">Fail Stage <span className="text-red-400">*</span></label>
                      <select value={failStage} onChange={e => setFailStage(e.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:border-[#0052D9]">
                        <option value="">请选择</option>
                        <option value="CP1">CP1</option>
                        <option value="CP2">CP2</option>
                        <option value="FT">FT</option>
                        <option value="SLT">SLT</option>
                        <option value="FAB">FAB</option>
                        <option value="其他">其他</option>
                      </select>
                    </div>
                    {/* Fail Ratio */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-slate-500">Fail Ratio <span className="text-red-400">*</span></label>
                      <input type="text" value={failRatio} onChange={e => setFailRatio(e.target.value)} placeholder="如：0.5%" className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#0052D9]" />
                    </div>
                    {/* Density */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-slate-500">Density <span className="text-red-400">*</span></label>
                      <select value={density} onChange={e => setDensity(e.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:border-[#0052D9]">
                        <option value="">请选择</option>
                        <option value="8Gb">8Gb</option>
                        <option value="16Gb">16Gb</option>
                        <option value="24Gb">24Gb</option>
                        <option value="32Gb">32Gb</option>
                        <option value="其他">其他</option>
                      </select>
                    </div>
                    {/* Mask Version */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-slate-500">Mask Version <span className="text-red-400">*</span></label>
                      <select value={maskVersion} onChange={e => setMaskVersion(e.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:border-[#0052D9]">
                        <option value="">请选择</option>
                        <option value="A0">A0</option>
                        <option value="A1">A1</option>
                        <option value="B0">B0</option>
                        <option value="B1">B1</option>
                        <option value="C0">C0</option>
                        <option value="其他">其他</option>
                      </select>
                    </div>
                    {/* Fail Package */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-slate-500">Fail Package <span className="text-red-400">*</span></label>
                      <select value={failPackage} onChange={e => setFailPackage(e.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:border-[#0052D9]">
                        <option value="">请选择</option>
                        <option value="BGA">BGA</option>
                        <option value="FBGA">FBGA</option>
                        <option value="WLCSP">WLCSP</option>
                        <option value="QFP">QFP</option>
                        <option value="裸片">裸片</option>
                        <option value="其他">其他</option>
                      </select>
                    </div>
                    {/* IO Type */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-slate-500">IO Type <span className="text-red-400">*</span></label>
                      <select value={ioType} onChange={e => setIoType(e.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:border-[#0052D9]">
                        <option value="">请选择</option>
                        <option value="x4">x4</option>
                        <option value="x8">x8</option>
                        <option value="x16">x16</option>
                        <option value="x32">x32</option>
                        <option value="其他">其他</option>
                      </select>
                    </div>
                    {/* Fail Platform */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-slate-500">Fail Platform <span className="text-red-400">*</span></label>
                      <input type="text" value={failPlatform} onChange={e => setFailPlatform(e.target.value)} placeholder="如：X86 / ARM" className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#0052D9]" />
                    </div>
                    {/* Customer */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-slate-500">Customer <span className="text-red-400">*</span></label>
                      <input type="text" value={customer} onChange={e => setCustomer(e.target.value)} placeholder="客户名称" className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#0052D9]" />
                    </div>
                  </>
                )}

                {/* lot/wafer 专属字段（5项） */}
                {material === "lot/wafer" && (
                  <>
                    {/* Fail Stage */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-slate-500">Fail Stage <span className="text-red-400">*</span></label>
                      <select value={failStage} onChange={e => setFailStage(e.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:border-[#0052D9]">
                        <option value="">请选择</option>
                        <option value="CP1">CP1</option>
                        <option value="CP2">CP2</option>
                        <option value="FT">FT</option>
                        <option value="SLT">SLT</option>
                        <option value="FAB">FAB</option>
                        <option value="其他">其他</option>
                      </select>
                    </div>
                    {/* Fail Ratio */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-slate-500">Fail Ratio <span className="text-red-400">*</span></label>
                      <input type="text" value={failRatio} onChange={e => setFailRatio(e.target.value)} placeholder="如：0.5%" className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#0052D9]" />
                    </div>
                    {/* Density */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-slate-500">Density <span className="text-red-400">*</span></label>
                      <select value={density} onChange={e => setDensity(e.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:border-[#0052D9]">
                        <option value="">请选择</option>
                        <option value="8Gb">8Gb</option>
                        <option value="16Gb">16Gb</option>
                        <option value="24Gb">24Gb</option>
                        <option value="32Gb">32Gb</option>
                        <option value="其他">其他</option>
                      </select>
                    </div>
                    {/* Mask Version */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-slate-500">Mask Version <span className="text-red-400">*</span></label>
                      <select value={maskVersion} onChange={e => setMaskVersion(e.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:border-[#0052D9]">
                        <option value="">请选择</option>
                        <option value="A0">A0</option>
                        <option value="A1">A1</option>
                        <option value="B0">B0</option>
                        <option value="B1">B1</option>
                        <option value="C0">C0</option>
                        <option value="其他">其他</option>
                      </select>
                    </div>
                    {/* Program */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-slate-500">Program <span className="text-red-400">*</span></label>
                      <input type="text" value={program} onChange={e => setProgram(e.target.value)} placeholder="程序名称" className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#0052D9]" />
                    </div>
                  </>
                )}
              </div>

              {(["IC", "DIMM", "lot/wafer"] as const).includes(material as "IC" | "DIMM" | "lot/wafer") && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="mb-3">
                  <div className="text-xs font-medium text-slate-700">
                    {material === "IC"
                      ? "IC 明细"
                      : material === "DIMM"
                        ? "DIMM 明细"
                        : material === "lot/wafer"
                          ? "Lot/Wafer 明细"
                          : "失效明细"}
                    <span className="text-slate-400 font-normal">
                      {material === "DIMM"
                        ? ` · ${dimmGrains.length} 条`
                        : material === "IC"
                          ? ` · ${icGrains.length} 颗`
                          : material === "lot/wafer"
                            ? ` · ${lotGrains.length} 条`
                            : ""}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {material === "IC"
                      ? "可添加多颗 IC，每颗独立填写属性"
                      : material === "DIMM"
                        ? "可添加多条 DIMM，每条独立填写属性"
                        : material === "lot/wafer"
                          ? "可添加多条 Lot/Wafer，每条独立填写属性"
                          : ""}
                  </div>
                </div>
              {/* IC 颗粒信息列表 */}
              {material === "IC" && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">IC 列表</span>
                    <button
                      type="button"
                      onClick={addIcGrain}
                      className="flex items-center gap-1 text-[11px] text-[#0052D9] hover:text-[#003FA8] transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      添加更多
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {icGrains.map((grain, idx) => {
                      const mc = getIcMarkCode(grain);
                      const ready = mc !== "—";
                      const inputCls = "mt-0.5 w-full h-7 rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#0052D9]/40";
                      return (
                        <div key={grain.id} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center gap-2.5 mb-2.5">
                            <IcChipIcon active={ready} />
                            <div className="min-w-0 flex-1">
                              <div className="text-[10.5px] text-slate-400">IC #{idx + 1}</div>
                              <div className={`font-mono text-[11px] truncate ${ready ? "text-[#0052D9]" : "text-slate-300"}`}>{mc}</div>
                            </div>
                            <button type="button" onClick={() => removeIcGrain(grain.id)} disabled={icGrains.length === 1} className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-500">Barcode <span className="text-red-400">*</span></label>
                              <input type="text" value={grain.barcode} onChange={e => updateIcGrain(grain.id, "barcode", e.target.value)} placeholder="条形码" className={inputCls} />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500">Chip ID <span className="text-red-400">*</span></label>
                              <input type="text" value={grain.chipid} onChange={e => updateIcGrain(grain.id, "chipid", e.target.value)} placeholder="芯片 ID" className={inputCls} />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500">Fail Mode <span className="text-red-400">*</span></label>
                              <input type="text" value={grain.failMode} onChange={e => updateIcGrain(grain.id, "failMode", e.target.value)} placeholder="失效模式" className={inputCls} />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500">Fail Condition <span className="text-red-400">*</span></label>
                              <input type="text" value={grain.failCondition} onChange={e => updateIcGrain(grain.id, "failCondition", e.target.value)} placeholder="失效条件" className={inputCls} />
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${ready ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>{ready ? "✓ 已完成" : "待补全"}</span>
                            <button type="button" onClick={() => openChipDNA(mc, icRows(grain))} title="查看 Chip DNA" className="ml-auto h-6 px-2 rounded border border-slate-200 text-[10.5px] text-slate-600 hover:border-[#0052D9]/50 hover:text-[#0052D9] hover:bg-[#0052D9]/5 transition-colors inline-flex items-center gap-1">
                              <Fingerprint className="w-3 h-3" /> Chip DNA
                            </button>
                            <button type="button" onClick={() => openOneClick(mc, icRows(grain))} title="查看 One Click" className="h-6 px-2 rounded border border-slate-200 text-[10.5px] text-slate-600 hover:border-[#0052D9]/50 hover:text-[#0052D9] hover:bg-[#0052D9]/5 transition-colors inline-flex items-center gap-1">
                              <MousePointerClick className="w-3 h-3" /> One Click
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* DIMM 列表 */}
              {material === "DIMM" && (
                <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">DIMM 列表</span>
                    <button
                      type="button"
                      onClick={addDimmGrain}
                      className="flex items-center gap-1 text-[11px] text-[#0052D9] hover:text-[#003FA8] transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      添加更多
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {dimmGrains.map((grain, idx) => {
                      const mc = getDimmMarkCode(grain);
                      const ready = mc !== "—";
                      const failedIcTags = parseDimmFailedIcs(grain.failedIcs);
                      const inputCls = "mt-0.5 w-full h-7 rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#0052D9]/40";
                      return (
                        <div key={grain.id} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center gap-2.5 mb-2.5">
                            <DimmModuleIcon active={ready} />
                            <div className="min-w-0 flex-1">
                              <div className="text-[10.5px] text-slate-400">DIMM #{idx + 1}</div>
                              <div className={`font-mono text-[11px] truncate ${ready ? "text-[#0052D9]" : "text-slate-300"}`}>{mc}</div>
                            </div>
                            <button type="button" onClick={() => removeDimmGrain(grain.id)} disabled={dimmGrains.length === 1} className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-500">SN <span className="text-red-400">*</span></label>
                              <input type="text" value={grain.sn} onChange={e => updateDimmGrain(grain.id, "sn", e.target.value)} placeholder="序列号" className={inputCls} />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500">Work Order <span className="text-red-400">*</span></label>
                              <input type="text" value={grain.workOrder} onChange={e => updateDimmGrain(grain.id, "workOrder", e.target.value)} placeholder="工单号" className={inputCls} />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500">Fail Mode <span className="text-red-400">*</span></label>
                              <input type="text" value={grain.failMode} onChange={e => updateDimmGrain(grain.id, "failMode", e.target.value)} placeholder="失效模式" className={inputCls} />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500">Fail Condition <span className="text-red-400">*</span></label>
                              <input type="text" value={grain.failCondition} onChange={e => updateDimmGrain(grain.id, "failCondition", e.target.value)} placeholder="失效条件" className={inputCls} />
                            </div>
                            <div className="col-span-2">
                              <label className="text-[10px] text-slate-500">Fail IC 位号 <span className="text-red-400">*</span></label>
                              <div className="mt-1 rounded-lg border border-slate-200 bg-white p-2">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[10px] text-slate-500">DIMM 板卡示意</span>
                                  <span className="text-[9.5px] text-slate-400">点击颗粒标记失效</span>
                                </div>
                                {/* PCB 板卡 */}
                                <div className="rounded-md bg-gradient-to-b from-[#0d5a39] to-[#0a4a2f] px-2 pt-2 pb-1.5 shadow-inner">
                                  <div className="flex items-end justify-center gap-1">
                                    {/* 左 rank */}
                                    <div className="flex gap-1">
                                      {DIMM_IC_POSITIONS.slice(0, 4).map((code) => {
                                        const on = failedIcTags.includes(code);
                                        return (
                                          <button
                                            key={code}
                                            type="button"
                                            onClick={() => toggleDimmFailedIc(grain.id, code)}
                                            title={`${code}${on ? " · 失效" : ""}`}
                                            className={`w-7 h-9 rounded-[2px] border text-[8px] font-mono flex items-center justify-center transition-all ${on ? "bg-red-500 border-red-400 text-white shadow-[0_0_0_2px_rgba(248,113,113,0.4)]" : "bg-slate-700 border-slate-600 text-slate-300 hover:border-red-300/70 hover:text-white"}`}
                                          >
                                            {code}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {/* 中间缺口（防呆槽） */}
                                    <div className="w-1.5 h-9 mx-0.5 rounded-sm bg-[#083a24] border-x border-[#062e1c]" />
                                    {/* 右 rank */}
                                    <div className="flex gap-1">
                                      {DIMM_IC_POSITIONS.slice(4).map((code) => {
                                        const on = failedIcTags.includes(code);
                                        return (
                                          <button
                                            key={code}
                                            type="button"
                                            onClick={() => toggleDimmFailedIc(grain.id, code)}
                                            title={`${code}${on ? " · 失效" : ""}`}
                                            className={`w-7 h-9 rounded-[2px] border text-[8px] font-mono flex items-center justify-center transition-all ${on ? "bg-red-500 border-red-400 text-white shadow-[0_0_0_2px_rgba(248,113,113,0.4)]" : "bg-slate-700 border-slate-600 text-slate-300 hover:border-red-300/70 hover:text-white"}`}
                                          >
                                            {code}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  {/* rank 标注 */}
                                  <div className="flex justify-between px-1 mt-1 text-[8px] text-emerald-100/60">
                                    <span>Rank L</span>
                                    <span>Rank R</span>
                                  </div>
                                  {/* 金手指 + 防呆缺口 */}
                                  <div className="mt-1 h-2 rounded-sm bg-gradient-to-b from-[#e7c455] to-[#c99a2e] relative overflow-hidden">
                                    <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-2 bg-[#0a4a2f]" />
                                  </div>
                                </div>
                                {/* 失效颗粒汇总 */}
                                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[10px]">
                                  <span className="text-slate-500 inline-flex items-center gap-1">
                                    <span className="w-2.5 h-2.5 rounded-[2px] bg-red-500 inline-block" />失效颗粒
                                  </span>
                                  {failedIcTags.length > 0 ? (
                                    failedIcTags.map((ic) => (
                                      <span key={ic} className="inline-flex items-center rounded border border-red-200 bg-red-50 text-red-600 px-1.5 py-0.5 font-mono">{ic}</span>
                                    ))
                                  ) : (
                                    <span className="text-slate-400">未标记（请在上方板卡点击）</span>
                                  )}
                                </div>
                                {/* 每颗失效颗粒的信息（复用 IC 字段） */}
                                {failedIcTags.length > 0 && (
                                  <div className="mt-2 space-y-2">
                                    {failedIcTags.map((code) => {
                                      const info = grain.failedIcInfo?.[code] || { barcode: "", chipid: "", failMode: "", failCondition: "" };
                                      return (
                                        <div key={code} className="rounded-md border border-slate-200 bg-slate-50/60 p-2">
                                          <div className="flex items-center gap-1.5 mb-1.5">
                                            <span className="inline-flex items-center rounded bg-red-500 text-white text-[9px] font-mono px-1.5 py-0.5">{code}</span>
                                            <span className="text-[10px] text-slate-500">颗粒失效信息</span>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2">
                                            <div>
                                              <label className="text-[10px] text-slate-500">Barcode <span className="text-red-400">*</span></label>
                                              <input type="text" value={info.barcode} onChange={e => updateDimmFailedIcInfo(grain.id, code, "barcode", e.target.value)} placeholder="条形码" className={inputCls} />
                                            </div>
                                            <div>
                                              <label className="text-[10px] text-slate-500">Chip ID <span className="text-red-400">*</span></label>
                                              <input type="text" value={info.chipid} onChange={e => updateDimmFailedIcInfo(grain.id, code, "chipid", e.target.value)} placeholder="芯片 ID" className={inputCls} />
                                            </div>
                                            <div>
                                              <label className="text-[10px] text-slate-500">Fail Mode <span className="text-red-400">*</span></label>
                                              <input type="text" value={info.failMode} onChange={e => updateDimmFailedIcInfo(grain.id, code, "failMode", e.target.value)} placeholder="失效模式" className={inputCls} />
                                            </div>
                                            <div>
                                              <label className="text-[10px] text-slate-500">Fail Condition <span className="text-red-400">*</span></label>
                                              <input type="text" value={info.failCondition} onChange={e => updateDimmFailedIcInfo(grain.id, code, "failCondition", e.target.value)} placeholder="失效条件" className={inputCls} />
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${ready ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>{ready ? "✓ 已完成" : "待补全"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* lot/wafer 信息列表 */}
              {material === "lot/wafer" && (
                <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">Lot/Wafer 列表</span>
                    <button
                      type="button"
                      onClick={addLotGrain}
                      className="flex items-center gap-1 text-[11px] text-[#0052D9] hover:text-[#003FA8] transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      添加更多
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {lotGrains.map((grain, idx) => {
                      const mc = getLotMarkCode(grain);
                      const ready = mc !== "—";
                      const inputCls = "mt-0.5 w-full h-7 rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#0052D9]/40";
                      return (
                        <div key={grain.id} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center gap-2.5 mb-2.5">
                            <WaferIcon active={ready} />
                            <div className="min-w-0 flex-1">
                              <div className="text-[10.5px] text-slate-400">Lot/Wafer #{idx + 1}</div>
                              <div className={`font-mono text-[11px] truncate ${ready ? "text-[#0052D9]" : "text-slate-300"}`}>{mc}</div>
                            </div>
                            <button type="button" onClick={() => removeLotGrain(grain.id)} disabled={lotGrains.length === 1} className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-500">Lot ID <span className="text-red-400">*</span></label>
                              <input type="text" value={grain.lotId} onChange={e => updateLotGrain(grain.id, "lotId", e.target.value)} placeholder="lot编号" className={inputCls} />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500">Wafer ID <span className="text-red-400">*</span></label>
                              <input type="text" value={grain.waferId} onChange={e => updateLotGrain(grain.id, "waferId", e.target.value)} placeholder="Wafer编号" className={inputCls} />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500">Chip ID <span className="text-red-400">*</span></label>
                              <input type="text" value={grain.chipId} onChange={e => updateLotGrain(grain.id, "chipId", e.target.value)} placeholder="Chip编号" className={inputCls} />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500">Fail Mode <span className="text-red-400">*</span></label>
                              <input type="text" value={grain.failMode} onChange={e => updateLotGrain(grain.id, "failMode", e.target.value)} placeholder="失效模式" className={inputCls} />
                            </div>
                            <div className="col-span-2">
                              <label className="text-[10px] text-slate-500">Fail Condition <span className="text-red-400">*</span></label>
                              <input type="text" value={grain.failCondition} onChange={e => updateLotGrain(grain.id, "failCondition", e.target.value)} placeholder="失效条件" className={inputCls} />
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${ready ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>{ready ? "✓ 已完成" : "待补全"}</span>
                            <button type="button" onClick={() => openChipDNA(mc, lotRows(grain))} title="查看 Chip DNA" className="ml-auto h-6 px-2 rounded border border-slate-200 text-[10.5px] text-slate-600 hover:border-[#0052D9]/50 hover:text-[#0052D9] hover:bg-[#0052D9]/5 transition-colors inline-flex items-center gap-1">
                              <Fingerprint className="w-3 h-3" /> Chip DNA
                            </button>
                            <button type="button" onClick={() => openOneClick(mc, lotRows(grain))} title="查看 One Click" className="h-6 px-2 rounded border border-slate-200 text-[10.5px] text-slate-600 hover:border-[#0052D9]/50 hover:text-[#0052D9] hover:bg-[#0052D9]/5 transition-colors inline-flex items-center gap-1">
                              <MousePointerClick className="w-3 h-3" /> One Click
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              </div>
              )}
            </div>
              </div>
            </div>
          </div>
        </section>

        {mode === "create" && (
          <section className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#0052D9]/8 text-[#0052D9] flex items-center justify-center text-[11px]">2</div>
              <h3 className="text-slate-900">Case 来源与相关 Issue</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[11px] text-slate-500">立案来源</label>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  {CASE_SOURCES.map((s) => (
                    <button key={s} type="button" onClick={() => setSource(s)}
                      className={`h-10 px-3 text-[11px] rounded-md border transition-all ${source === s ? "bg-[#0052D9] text-white border-[#0052D9] shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                      {s === "手动" ? "Checklist 检查" : s === "Q·FAQA" ? "Q·FAQA 客诉" : s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-slate-500">归属 Issue</label>
                </div>
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setIssueLinkMode("later"); setAttachIssueIds([]); setNewIssueName(""); }}
                    className={`h-10 px-3 text-[11px] rounded-md border transition-all ${issueLinkMode === "later" ? "bg-[#0052D9] text-white border-[#0052D9] shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    暂时无法关联
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueLinkMode("now")}
                    className={`h-10 px-3 text-[11px] rounded-md border transition-all ${issueLinkMode === "now" ? "bg-[#0052D9] text-white border-[#0052D9] shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    现在关联 Issue
                  </button>
                </div>
                {issueLinkMode === "later" ? (
                  <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded px-3 py-2">
                    暂不关联 Issue。现在还不清楚共性时可先跳过；<b className="text-slate-600">结案前需关联至少一个 Issue</b>。
                  </div>
                ) : (
                <>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={issueQ} onChange={(e) => setIssueQ(e.target.value)} placeholder="查找 Issue 编号 / 名称"
                      className="h-8 w-full pl-8 pr-3 text-sm rounded-md border border-slate-200 outline-none focus:border-[#0052D9]" />
                  </div>
                  <select value={issueObjType} onChange={(e) => setIssueObjType(e.target.value)} className="h-8 px-2 text-sm rounded-md border border-slate-200 bg-white outline-none focus:border-[#0052D9]">
                    {["全部", ...OBJECT_TYPES].map((o) => <option key={o} value={o}>{o === "全部" ? "对象类型" : o}</option>)}
                  </select>
                  <select value={issueStatusF} onChange={(e) => setIssueStatusF(e.target.value)} className="h-8 px-2 text-sm rounded-md border border-slate-200 bg-white outline-none focus:border-[#0052D9]">
                    {["全部", ...ISSUE_STATUS_OPTS].map((o) => <option key={o} value={o}>{o === "全部" ? "状态" : o}</option>)}
                  </select>
                </div>
                <div className="mt-1.5 max-h-[160px] overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-50">
                  {filteredIssues.map((iss) => {
                    const on = attachIssueIds.includes(iss.id);
                    return (
                      <label key={iss.id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${on ? "bg-[#0052D9]/[0.04]" : "hover:bg-slate-50"}`}>
                        <input type="checkbox" checked={on} onChange={() => setAttachIssueIds((prev) => on ? prev.filter((x) => x !== iss.id) : [...prev, iss.id])} className="accent-[#0052D9]" />
                        <span className="font-mono text-[11px] text-slate-400">{iss.code}</span>
                        <span className="text-sm text-slate-800 flex-1 min-w-0 truncate">{iss.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] border ${objectTypeColors[iss.objectType]}`}>{iss.objectType}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] border ${issueStatusColors[iss.status]}`}>{iss.status}</span>
                      </label>
                    );
                  })}
                  {filteredIssues.length === 0 && <div className="px-3 py-3 text-xs text-slate-400">无匹配 Issue</div>}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 shrink-0">或新建 Issue</span>
                  <input value={newIssueName} onChange={(e) => setNewIssueName(e.target.value)} placeholder="填写 Issue 名称将新建并关联（可留空）"
                    className="flex-1 h-8 px-2.5 text-sm rounded-md border border-slate-200 outline-none focus:border-[#0052D9]" />
                </div>
                </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Section 2: Tasks via shared MindMap */}
        <section className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#0052D9]/8 text-[#0052D9] flex items-center justify-center text-[11px]">
              3
            </div>
            <h3 className="text-slate-900">Case 拆解与协作</h3>
            <span className="ml-auto text-[11px] text-slate-500">
              共{" "}
              <b className="text-slate-800">{tasks.length}</b>{" "}
              个怀疑目标
            </span>
          </div>

          <div className="p-5">
            <CreateCaseMindMapFlow
              caseData={synthesizedCase}
              thoughtGroups={thoughtGroups}
              onGroupsChange={setThoughtGroups}
            />
          </div>
        </section>
      </div>

      {/* Frozen bottom action bar */}
      <div className="sticky bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-[0_-2px_8px_rgba(15,23,42,0.04)]">
        <div className="max-w-[1200px] mx-auto px-8 py-3 flex items-center justify-end gap-2">
          <button
            onClick={onDone}
            className="h-9 px-4 rounded-md border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={handleReset}
            className="h-9 px-4 rounded-md border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <RotateCcw size={14} />
            重置
          </button>
          {mode === "create" && (
            <button
              onClick={onDone}
              disabled={!name.trim()}
              title="暂存草稿，可在 Case 中心『暂存』状态继续编辑"
              className="h-9 px-4 rounded-md border border-amber-300 bg-amber-50 text-sm text-amber-700 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              暂存
            </button>
          )}
          <button
            onClick={finalSubmit}
            disabled={!canSubmit}
            className="h-9 px-4 rounded-md bg-gradient-to-r from-[#0052D9] to-[#003FA8] text-white text-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Check size={14} />
            {submitLabel}
          </button>
        </div>
      </div>

      {/* 功能1：AI 智能识别填充弹窗 */}
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-6" onMouseDown={() => setAiOpen(false)}>
          <div className="w-[640px] max-w-[92vw] max-h-[86vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7A3DFF] to-[#0052D9] text-white grid place-items-center"><Wand2 size={16} /></div>
              <div>
                <div className="text-slate-900 font-semibold text-[15px]">AI 智能识别填充</div>
                <div className="text-[11.5px] text-slate-400">粘贴一段问题描述，自动识别并填充到对应字段（演示）</div>
              </div>
              <button onClick={() => setAiOpen(false)} className="ml-auto w-8 h-8 rounded-md hover:bg-slate-100 grid place-items-center text-slate-400"><XIcon size={16} /></button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              <div className="relative">
                <textarea
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  placeholder="例如：客户反馈 DMJFC 在 FT 高温段出现批量 Icc 漏电超规，失效比例 0.8%，密度 16Gb……"
                  className="w-full min-h-[130px] p-3 rounded-lg border border-slate-200 bg-slate-50/60 text-sm outline-none focus:bg-white focus:border-[#7A3DFF]"
                />
                <button onClick={() => setAiText(AI_SAMPLE)} className="absolute right-2 bottom-2 text-[11px] px-2 py-1 rounded border border-slate-200 bg-white text-slate-500 hover:text-[#7A3DFF] hover:border-[#7A3DFF]/40 flex items-center gap-1"><ClipboardPaste size={12} /> 用示例</button>
              </div>
              <div className="flex justify-end">
                <button onClick={runAiParse} disabled={!aiText.trim() || aiBusy} className="h-9 px-4 rounded-md bg-gradient-to-r from-[#7A3DFF] to-[#0052D9] text-white text-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
                  {aiBusy ? <><Loader2 size={14} className="animate-spin" /> 识别中…</> : <><Sparkles size={14} /> 识别并预览</>}
                </button>
              </div>
              {aiResult && (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[12px] text-slate-600 flex items-center justify-between">
                    <span>识别到 <b className="text-[#7A3DFF]">{aiResult.length}</b> 个字段，勾选后填充</span>
                    <span className="text-[11px] text-slate-400">可取消勾选不需要的项</span>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-100">
                    {aiResult.map((f) => (
                      <label key={f.key} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={!!aiPicked[f.key]} onChange={(e) => setAiPicked((p) => ({ ...p, [f.key]: e.target.checked }))} className="mt-0.5 accent-[#7A3DFF]" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] text-slate-400">{f.label}</div>
                          <div className="text-[13px] text-slate-800 break-words">{f.value}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button onClick={() => setAiOpen(false)} className="h-9 px-4 rounded-md border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={applyAiFields} disabled={!aiResult || aiResult.length === 0} className="h-9 px-4 rounded-md bg-[#0052D9] text-white text-sm hover:bg-[#003FA8] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"><Check size={14} /> 填充到表单</button>
            </div>
          </div>
        </div>
      )}

      {/* 功能2：DIMM 按颗粒拆分为子 Case 弹窗 */}
      {dimmSplitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-6" onMouseDown={() => setDimmSplitOpen(false)}>
          <div className="w-[720px] max-w-[94vw] max-h-[86vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0052D9] to-[#00A4FF] text-white grid place-items-center"><Network size={16} /></div>
              <div>
                <div className="text-slate-900 font-semibold text-[15px]">拆分 DIMM 为子 Case</div>
                <div className="text-[11.5px] text-slate-400">每个失效 DIMM 拆成一个独立子 Case，与当前 Case 建立父子关系（演示）</div>
              </div>
              <button onClick={() => setDimmSplitOpen(false)} className="ml-auto w-8 h-8 rounded-md hover:bg-slate-100 grid place-items-center text-slate-400"><XIcon size={16} /></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="rounded-lg border border-[#0052D9]/30 bg-[#0052D9]/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0052D9] text-white">父 Case</span>
                  <span className="text-[14px] font-medium text-slate-900 truncate">{name || "（未命名 Case）"}</span>
                  <span className="text-[11px] text-slate-400 ml-auto font-mono">DRAFT-NEW · DIMM</span>
                </div>
                <div className="text-[11.5px] text-slate-500 mt-1">保留整体背景与影响；拆分后作为 {dimmSplitGroups.length} 个子 Case 的父节点，用于汇总跟踪。</div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-[12px] text-slate-600">选择要拆分的 DIMM（可只拆部分，不必每个都拆）</div>
                <label className="flex items-center gap-1.5 text-[12px] text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={dimmSplitMerge} onChange={(e) => setDimmSplitMerge(e.target.checked)} className="accent-[#0052D9]" />
                  按失效模式合并同类 DIMM
                </label>
              </div>
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                {dimmSplittable.map((g) => (
                  <label key={g.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={!!dimmSplitSel[g.id]} onChange={(e) => setDimmSplitSel((p) => ({ ...p, [g.id]: e.target.checked }))} className="accent-[#0052D9]" />
                    <span className="font-mono text-[11px] text-slate-500 w-28 shrink-0 truncate">{getDimmMarkCode(g)}</span>
                    <span className="text-[12px] text-slate-700 flex-1 truncate">{g.failMode} · {g.failCondition}</span>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">{g.sn}</span>
                  </label>
                ))}
              </div>

              <div>
                <div className="text-[12px] text-slate-600 mb-2">将生成 <b className="text-[#0052D9]">{dimmSplitGroups.length}</b> 个子 Case{dimmSplitMerge ? "（同失效模式已合并）" : ""}</div>
                {dimmSplitGroups.length === 0 ? (
                  <div className="text-[12px] text-slate-400 border border-dashed border-slate-200 rounded-lg px-4 py-4 text-center">未选择 DIMM，请至少勾选一个</div>
                ) : (
                  <div className="relative pl-5">
                    <span className="absolute left-1.5 top-0 bottom-3 w-px bg-slate-200" />
                    <div className="space-y-2.5">
                      {dimmSplitGroups.map((grp, idx) => (
                        <div key={idx} className="relative">
                          <span className="absolute -left-[14px] top-5 w-3 h-px bg-slate-200" />
                          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00A4FF]/12 text-[#0284c7]">子 Case {idx + 1}</span>
                              <span className="text-[13.5px] font-medium text-slate-900 truncate">{(name || "（未命名 Case）")} · {grp.label}</span>
                              <span className="text-[11px] text-slate-400 ml-auto font-mono">DRAFT-C{String(idx + 1).padStart(2, "0")}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {grp.grains.map((g) => (
                                <span key={g.id} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">{getDimmMarkCode(g)} · {g.failCondition || "—"}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {dimmSplitDone && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-[12.5px] text-emerald-700 flex items-center gap-2">
                  <Check size={14} /> 已生成 {dimmSplitGroups.length} 个子 Case（演示）。父子关系已建立，可在 Case 中心查看层级。
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">已选 {dimmSplitGroups.reduce((a, g) => a + g.grains.length, 0)} / {dimmSplittable.length} 颗粒 · 生成 {dimmSplitGroups.length} 子 Case</span>
              <div className="flex gap-2">
                <button onClick={() => setDimmSplitOpen(false)} className="h-9 px-4 rounded-md border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">{dimmSplitDone ? "关闭" : "取消"}</button>
                {!dimmSplitDone && (
                  <button onClick={() => setDimmSplitDone(true)} disabled={dimmSplitGroups.length === 0} className="h-9 px-4 rounded-md bg-gradient-to-r from-[#0052D9] to-[#003FA8] text-white text-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"><Network size={14} /> 确认拆分为 {dimmSplitGroups.length} 个子 Case</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 功能1：AI 智能识别填充 —— 启发式解析器（演示） ----------interface AiField { key: string; label: string; value: string; }
function parseCaseDescription(text: string): AiField[] {
  const t = text;
  const firstIncl = (arr: string[]) => arr.find((v) => new RegExp(v, "i").test(t)) || "";
  const pick = (re: RegExp) => { const m = t.match(re); return m ? (m[1] ?? m[0]).trim() : ""; };
  const material = /DIMM/i.test(t) ? "DIMM" : /(lot|wafer|晶圆)/i.test(t) ? "lot/wafer" : /(\bIC\b|颗粒|裸片|芯片)/.test(t) ? "IC" : "";
  const product = firstIncl(["DMJFC", "PAROG", "RCPQC", "CCNPM", "GTROC"]);
  const density = firstIncl(["8Gb", "16Gb", "24Gb", "32Gb"]);
  const failStage = firstIncl(["CP1", "CP2", "FT", "SLT", "FAB"]);
  const ioType = ["x4", "x8", "x16", "x32"].find((v) => new RegExp(`\\b${v}\\b`, "i").test(t)) || "";
  const failPackage = firstIncl(["FBGA", "WLCSP", "BGA", "QFP"]);
  const failPlatform = firstIncl(["X86", "ARM"]);
  const customer = pick(/客户[:：]?\s*([^\s，。,；;]+)/);
  const failRatio = pick(/(\d+(?:\.\d+)?\s*%)/);
  const ppm = pick(/(\d+)\s*ppm/i);
  const level = pick(/\b(L[1-5])\b/);
  const urgency = firstIncl(["非常紧急", "不紧急", "紧急", "一般"]);
  const failMode = firstIncl(["漏电", "开路", "短路", "停机", "保持力", "时序", "漂移", "翻转", "良率", "yield", "超规"]);
  const name = (t.split(/[\n。]/).map((s) => s.trim()).filter(Boolean)[0] || "").slice(0, 40);
  const impact = (t.split(/[\n。]/).map((s) => s.trim()).find((s) => /影响|退货|停机|交付|损失|风险/.test(s)) || "");
  const background = t.trim();
  const raw: [string, string, string][] = [
    ["name", "Case 名称", name],
    ["level", "层级", level],
    ["urgency", "紧急程度", urgency],
    ["product", "产品编码", product],
    ["material", "案件物料", material],
    ["density", "Density", density],
    ["failStage", "Fail Stage", failStage],
    ["ioType", "IO Type", ioType],
    ["failPackage", "Fail Package", failPackage],
    ["failPlatform", "Fail Platform", failPlatform],
    ["failRatio", "Fail Ratio", failRatio],
    ["customer", "Customer", customer],
    ["failMode", "失效模式", failMode],
    ["ppm", "PPM", ppm],
    ["impact", "影响", impact],
    ["background", "背景.事由", background],
  ];
  return raw.filter(([, , v]) => v && v.trim()).map(([key, label, value]) => ({ key, label, value }));
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <span className="text-slate-400">{k}</span>
      <div className={`font-mono truncate ${v === "—" ? "text-slate-300" : "text-slate-700"}`}>{v}</div>
    </div>
  );
}

function IcChipIcon({ active = false }: { active?: boolean }) {
  const body = active ? "#0052D9" : "#CBD5E1";
  const pin = active ? "#00A4FF" : "#94A3B8";
  return (
    <svg viewBox="0 0 40 40" className="w-9 h-9 shrink-0">
      <g fill={pin}>
        <rect x="3" y="13" width="4" height="2.4" rx="1" />
        <rect x="3" y="18.8" width="4" height="2.4" rx="1" />
        <rect x="3" y="24.6" width="4" height="2.4" rx="1" />
        <rect x="33" y="13" width="4" height="2.4" rx="1" />
        <rect x="33" y="18.8" width="4" height="2.4" rx="1" />
        <rect x="33" y="24.6" width="4" height="2.4" rx="1" />
        <rect x="13" y="3" width="2.4" height="4" rx="1" />
        <rect x="18.8" y="3" width="2.4" height="4" rx="1" />
        <rect x="24.6" y="3" width="2.4" height="4" rx="1" />
        <rect x="13" y="33" width="2.4" height="4" rx="1" />
        <rect x="18.8" y="33" width="2.4" height="4" rx="1" />
        <rect x="24.6" y="33" width="2.4" height="4" rx="1" />
      </g>
      <rect x="7" y="7" width="26" height="26" rx="6" fill={body} />
      <rect x="14.5" y="14.5" width="11" height="11" rx="2.5" fill="#ffffff" opacity="0.22" />
      <circle cx="11.5" cy="11.5" r="1.7" fill="#ffffff" opacity="0.9" />
    </svg>
  );
}

function DimmModuleIcon({ active = false }: { active?: boolean }) {
  const body = active ? "#0052D9" : "#CBD5E1";
  const pin = active ? "#00A4FF" : "#94A3B8";
  return (
    <svg viewBox="0 0 40 40" className="w-9 h-9 shrink-0">
      <rect x="4" y="11" width="32" height="15" rx="2.5" fill={body} />
      <g fill="#ffffff" opacity="0.85">
        <rect x="8" y="15" width="6" height="7" rx="1" />
        <rect x="17" y="15" width="6" height="7" rx="1" />
        <rect x="26" y="15" width="6" height="7" rx="1" />
      </g>
      <g fill={pin}>
        <rect x="7" y="27" width="2.2" height="5" rx="0.8" />
        <rect x="11.5" y="27" width="2.2" height="5" rx="0.8" />
        <rect x="16" y="27" width="2.2" height="5" rx="0.8" />
        <rect x="20.5" y="27" width="2.2" height="5" rx="0.8" />
        <rect x="25" y="27" width="2.2" height="5" rx="0.8" />
        <rect x="29.5" y="27" width="2.2" height="5" rx="0.8" />
      </g>
    </svg>
  );
}

function WaferIcon({ active = false }: { active?: boolean }) {
  const body = active ? "#0052D9" : "#CBD5E1";
  return (
    <svg viewBox="0 0 40 40" className="w-9 h-9 shrink-0">
      <circle cx="20" cy="20" r="15" fill={body} />
      <g stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1">
        <line x1="12" y1="7.5" x2="12" y2="32.5" />
        <line x1="20" y1="5.5" x2="20" y2="34.5" />
        <line x1="28" y1="7.5" x2="28" y2="32.5" />
        <line x1="7.5" y1="12" x2="32.5" y2="12" />
        <line x1="5.5" y1="20" x2="34.5" y2="20" />
        <line x1="7.5" y1="28" x2="32.5" y2="28" />
      </g>
      <rect x="16" y="33" width="8" height="3" rx="1" fill="#ffffff" />
    </svg>
  );
}

function Field({
  label,
  required,
  labelExtra,
  children,
}: {
  label: string;
  required?: boolean;
  labelExtra?: React.ReactNode;
  children: any;
}) {
  return (
    <div>
      <div className="text-xs text-slate-600 mb-1.5 tracking-wide flex items-center">
        {label}{" "}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {labelExtra}
      </div>
      {children}
    </div>
  );
}

function SmallField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs text-slate-500">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full h-9 px-2.5 text-sm rounded border border-slate-200 bg-white outline-none focus:border-[#0052D9]"
      />
    </label>
  );
}

export type ActionCard = {
  id: string;
  title: string;
  expectation?: string;
  urgency: Urgency;
  department: string;
  supervisor?: string;
  assignee: string;
  dueDate: string;
  note?: string;
  voiceNote?: string;
  attachments?: Att[];
  childGroups?: ThoughtGroup[];
};

export type ThoughtGroup = {
  id: string;
  thought: string;
  category?: string;
  actions: ActionCard[];
};