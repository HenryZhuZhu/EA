export type Level = "L1" | "L2" | "L3" | "L4" | "L5";
export type Urgency = "非常紧急" | "紧急" | "一般" | "不紧急";
export type CaseStatus = "进行中" | "待处理" | "已关闭" | "Pending" | "已升级";
export type Site = "CP" | "FT" | "RDBI" | "SLT";
export const SITES: Site[] = ["CP", "FT", "RDBI", "SLT"];
export type Validity = "有效" | "部分有效" | "无效";
export type TaskType = "FSA分析" | "测试程式分析" | "测试代码分析" | "SLT复现";
export const TASK_TYPES: TaskType[] = ["FSA分析", "测试程式分析", "测试代码分析", "SLT复现"];

export interface CommentReply {
  id: string;
  user: string;
  time: string;
  content: string;
}
export interface TaskComment {
  id: string;
  user: string;
  time: string;
  content: string;
  replies?: CommentReply[];
}
export interface TaskNode {
  id: string;
  code?: string;            // 任务编号，格式：EA-260511000001.001
  title: string;
  owner: string;            // 当前执行人（工程师，可为"待指派"）
  supervisor?: string;      // 主管，权限归属
  department: string;
  site?: Site;              // 所属站点
  siteOwner?: string;       // 站点管理员（分发人）
  urgency: Urgency;
  progress: number;
  status: "待开始" | "待接受" | "进行中" | "已拒绝" | "已完成" | "已中止";
  expectation?: string;     // 预期（本动作想验证/达成什么）
  conclusion?: string;
  validity?: Validity;      // 结论有效性
  terminateReason?: string; // 中止理由（已中止）
  rejectReason?: string;    // 拒绝理由（已拒绝）
  attachments?: { name: string; kind: "pdf" | "image" | "sheet" | "file"; url?: string }[]; // 任务数据/附件（url 用于图片预览）
  manualPos?: { x: number; y: number }; // 思维导图手动拖拽位置（持久化）
  type?: TaskType;          // 任务类型
  category?: string;        // 思路/怀疑方向的分类标签（用户可编辑）
  voiceNote?: string;       // 语音备注（录音 data URL，可回放）
  note?: string;            // 分派附言
  suspicion?: string;       // 怀疑目标（问题分析视角）
  children?: TaskNode[];
  recommendedActions?: string[];
  requestedDueDate?: string; // 发起人期望时间
  dueDate?: string;          // 接收人修正后的完成时间
  dueIn?: number;
  likes?: number;
  likedByMe?: boolean;
  comments?: TaskComment[];
  // —— V1.0.3 数据地基 ——
  // 状态时间戳：每次状态变更追加一条，用于派单响应时长 / 各阶段停留 / SLA / Aging
  statusHistory?: { status: TaskNode["status"]; at: string; by?: string }[];
}

export interface Participant {
  name: string;
  department: string;
}

export interface CaseItem {
  id: string;
  code: string;
  name: string;
  owner: string;
  participants?: Participant[];
  level: Level;
  urgency: Urgency;
  status: CaseStatus;
  reason: string;
  background: string;
  impact?: string;          // 影响（必填，新建时录入）
  caseAttachments?: { name: string; kind: "pdf" | "image" | "sheet" | "file"; url?: string }[]; // 背景/创建附件
  levelReason: string;
  product: string;
  material: string;
  density: string;
  ioType: string;
  failStage: string;
  customer: string;
  failPlatform: string;
  failMode: string;
  failRatio?: string;
  failPackage?: string;
  ppm: string;
  pdId: string;
  createdAt: string;
  updatedAt: string;
  departments: string[];
  tasks: TaskNode[];
  granules?: { markCode: string; sn: string; workOrder: string; failMode: string; failCondition: string }[];
  // —— V1.0.3：DIMM 按颗粒拆分（父子 Case 关系）——
  parentCaseId?: string;      // 本 Case 由某父 Case 按颗粒拆分而来
  childCaseIds?: string[];    // 本 Case 拆分出的子 Case 列表
  splitGranule?: { markCode: string; sn: string; failMode: string; failCondition: string }; // 该子 Case 对应的颗粒
  // —— V1.0.3：产品 / Issue / 来源 / 解题路径（领域模型对齐）——
  productId?: string;         // 归属产品（一级实体 Product.id）；手动 Case 可为空
  source?: IssueSource;       // Case 来源（检查项Fail / MC·WBS / SC·FAE / Q·FAQA / 手动 / fanout验证）
  solutionPath?: string[];    // 结案时人工勾选的「解题路径」：命中有效结论的 task id 集合
  fanoutOfIssueId?: string;   // 若本 Case 由某 Issue 的强制 fanout 派生，则回指该 Issue
  aiSummary: {
    progress: string;
    method: string;
    conclusion: string;
    solution: string;
    risk: string;
  };
  timeline: { time: string; user: string; content: string }[];
  dueIn: number;
}

export const departments = ["PTE", "CP", "FT", "DA", "PE", "QA", "EFA", "RD", "PM"];

export const departmentSupervisors: Record<string, string> = {
  PTE: "周主管",
  CP: "陈主管",
  FT: "黄主管",
  DA: "李主管",
  PE: "吴主管",
  QA: "赵主管",
  EFA: "郑主管",
  RD: "孙主管",
  PM: "钱主管",
};

// 负责人到部门的映射关系
export const ownerToDepartment: Record<string, string> = {
  "张伟": "PTE",
  "李娜": "DA",
  "陈磊": "EFA",
  "王芳": "CP",
  "刘洋": "PTE",
  "赵敏": "FT",
  "孙楠": "QA",
  "周杰": "PTE",
  "周宇": "PE",
  "李昊": "PE",
  "吴迪": "PE",
  "周主管": "PTE",
  "陈主管": "CP",
  "黄主管": "FT",
  "李主管": "DA",
  "吴主管": "PE",
  "赵主管": "QA",
  "郑主管": "EFA",
  "孙主管": "RD",
  "钱主管": "PM",
};

// ===== V1.0.3 组织架构（Mock）：工程师 → 主管 → 总监 → VP =====
// 真实数据缺失，以下为占位组织架构，供"决策台 / 简报"按管理者分管范围 scope。
export type OrgRole = "VP" | "总监" | "主管" | "工程师";
export const vp = "林副总";
export const directors: { name: string; title: string; departments: string[] }[] = [
  { name: "高总监", title: "测试总监", departments: ["PTE", "CP", "FT", "DA"] },
  { name: "马总监", title: "工艺总监", departments: ["PE", "QA", "EFA"] },
  { name: "赵总监", title: "设计总监", departments: ["RD", "PM"] },
];
// 部门 → 分管总监
export const deptToDirector: Record<string, string> = Object.fromEntries(
  directors.flatMap((d) => d.departments.map((dep) => [dep, d.name]))
);
// 角色判定
export const orgRole = (name: string): OrgRole =>
  name === vp ? "VP"
  : directors.some((d) => d.name === name) ? "总监"
  : Object.values(departmentSupervisors).includes(name) ? "主管"
  : "工程师";
// 直接上级（下级 → 上级）
export const reportsTo = (name: string): string | null => {
  const role = orgRole(name);
  if (role === "VP") return null;
  if (role === "总监") return vp;
  if (role === "主管") { const dep = ownerToDepartment[name]; return dep ? deptToDirector[dep] ?? vp : vp; }
  const dep = ownerToDepartment[name];
  return dep ? departmentSupervisors[dep] ?? null : null;
};
// 管理者分管的部门集合（看板 / 简报 scope 用）：VP=全公司，总监=分管线，主管=本部门
export const managerDeptScope = (name: string): string[] => {
  const role = orgRole(name);
  if (role === "VP") return [...departments];
  if (role === "总监") return directors.find((d) => d.name === name)?.departments ?? [];
  if (role === "主管") { const dep = ownerToDepartment[name]; return dep ? [dep] : []; }
  return [];
};
// 简报策略：总监=周报（平台"我的"内查看）；VP=月报（邮件推送）；其余无简报
export const briefingPolicy = (name: string): { cadence: "周报" | "月报" | null; channel: "平台" | "邮件" | null } => {
  const role = orgRole(name);
  if (role === "总监") return { cadence: "周报", channel: "平台" };
  if (role === "VP") return { cadence: "月报", channel: "邮件" };
  return { cadence: null, channel: null };
};

export const levelColors: Record<Level, string> = {
  L1: "bg-red-50 text-red-600 border-red-200",
  L2: "bg-orange-50 text-orange-600 border-orange-200",
  L3: "bg-amber-50 text-amber-600 border-amber-200",
  L4: "bg-blue-50 text-blue-600 border-blue-200",
  L5: "bg-slate-50 text-slate-600 border-slate-200",
};

export const urgencyColors: Record<Urgency, string> = {
  非常紧急: "bg-red-500 text-white",
  紧急: "bg-orange-500 text-white",
  一般: "bg-blue-500 text-white",
  不紧急: "bg-slate-400 text-white",
};

export type TaskStatus = "待开始" | "待接受" | "进行中" | "已拒绝" | "已完成" | "已中止";

// 结论有效性 → 胶囊（收敛配色：中性底，仅图标着色，见 validityIconColor）
export const validityColors: Record<Validity, string> = {
  有效: "bg-slate-50 text-slate-600 border-slate-200",
  部分有效: "bg-slate-50 text-slate-600 border-slate-200",
  无效: "bg-slate-50 text-slate-600 border-slate-200",
};

// 结论有效性 → 图标颜色（有效=绿 / 部分有效=琥珀 / 无效=中性灰，不用红，避让紧急度）
export const validityIconColor: Record<Validity, string> = {
  有效: "text-emerald-600",
  部分有效: "text-amber-600",
  无效: "text-slate-500",
};

// 紧急程度 → 卡片底色（思维导图小卡片用底色区分紧急度）
export const urgencyCardColors: Record<Urgency, string> = {
  非常紧急: "bg-red-50/80 border-red-200",
  紧急: "bg-orange-50/80 border-orange-200",
  一般: "bg-sky-50/70 border-sky-200",
  不紧急: "bg-slate-50 border-slate-200",
};

// 紧急程度 → 任务卡左侧细色条（卡身保持白底，仅用左色条表达紧急度）
export const urgencyAccent: Record<Urgency, string> = {
  非常紧急: "border-l-red-400",
  紧急: "border-l-orange-400",
  一般: "border-l-sky-400",
  不紧急: "border-l-slate-300",
};

// 紧急程度 → 左侧细色条（唯一彩色通道：非常紧急红 / 紧急橙 / 一般天蓝 / 不紧急灰）
export const urgencyBar: Record<Urgency, string> = {
  非常紧急: "bg-[#FF3B30]",
  紧急: "bg-[#FF9500]",
  一般: "bg-[#38BDF8]",
  不紧急: "bg-[#94A3B8]",
};

// 任务状态 → 标签/胶囊（方案 B：仅「进行中」淡蓝、「已完成」淡绿，其余一律中性灰）
export const statusColors: Record<TaskStatus, string> = {
  待开始: "bg-slate-100 text-slate-500 border-slate-200",
  待接受: "bg-slate-100 text-slate-500 border-slate-200",
  进行中: "bg-blue-50 text-blue-600 border-blue-200",
  已拒绝: "bg-slate-100 text-slate-500 border-slate-200",
  已完成: "bg-emerald-50 text-emerald-600 border-emerald-200",
  已中止: "bg-slate-100 text-slate-500 border-slate-200 line-through",
};

// 任务状态 → 圆点颜色（方案 B：进行中蓝 / 已完成绿 / 其余灰）
export const statusDot: Record<TaskStatus, string> = {
  待开始: "bg-slate-400",
  待接受: "bg-slate-400",
  进行中: "bg-blue-500",
  已拒绝: "bg-slate-400",
  已完成: "bg-emerald-500",
  已中止: "bg-slate-400",
};

// 离线演示语音：生成一段很短的 WAV 音频，用于展示任务卡和详情页的播放控件。
function demoVoiceNote(): string {
  const sampleRate = 4000;
  const duration = 2;
  const sampleCount = sampleRate * duration;
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  let offset = 0;
  const writeText = (text: string) => { for (const char of text) view.setUint8(offset++, char.charCodeAt(0)); };
  const write32 = (value: number) => { view.setUint32(offset, value, true); offset += 4; };
  const write16 = (value: number) => { view.setUint16(offset, value, true); offset += 2; };
  writeText("RIFF"); write32(36 + sampleCount * 2); writeText("WAVEfmt ");
  write32(16); write16(1); write16(1); write32(sampleRate); write32(sampleRate * 2);
  write16(2); write16(16); writeText("data"); write32(sampleCount * 2);
  for (let i = 0; i < sampleCount; i += 1) {
    const time = i / sampleRate;
    const envelope = Math.min(1, time * 4, (duration - time) * 4);
    const sample = Math.sin(2 * Math.PI * (220 + 40 * Math.sin(2 * Math.PI * 2 * time)) * time) * 0.18 * envelope;
    view.setInt16(offset, sample * 32767, true);
    offset += 2;
  }
  let binary = "";
  new Uint8Array(buffer).forEach((byte) => { binary += String.fromCharCode(byte); });
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export const mockCases: CaseItem[] = [
  {
    id: "c001",
    code: "EA-260511000001",
    name: "DDR5 X-die CP1 yield drop @Site A",
    owner: "张伟",
    participants: [
      { name: "李娜", department: "DA" },
      { name: "陈磊", department: "EFA" },
      { name: "王芳", department: "CP" },
      { name: "赵敏", department: "FT" },
    ],
    level: "L2",
    urgency: "非常紧急",
    status: "进行中",
    reason: "客户反馈批量良率低于基线 3.5%，需立即定位并给出改善方案。",
    background:
      "近两周 Site A DDR5 X-die 在 CP1 出现 yield 异常，平均下降 3.5%，影响 Lot 数已达 42 批，客户已发出质量预警。",
    impact:
      "影响 42 批 Lot、约 3500 PPM；客户 Customer-K 已发质量预警，若未在 2 天内定位将触发交付延期与潜在退货风险。",
    levelReason:
      "由 L5 升级至 L2：影响范围已覆盖跨三级部门（PTE/CP/DA/EFA），且涉及客户端预警，需调用项目级资源。",
    product: "DDR5-X-6400",
    material: "XDIE-A0",
    density: "16Gb",
    ioType: "x16",
    failStage: "CP1",
    customer: "Customer-K",
    failPlatform: "V93K-SMU8",
    failMode: "ICC2 超规格",
    failRatio: "2.35%",
    failPackage: "BGA-96",
    ppm: "3500",
    pdId: "PD-2026-0417",
    createdAt: "2026-04-15",
    updatedAt: "2026-04-22 10:24",
    dueIn: 2,
    productId: "DDR5-X-6400",
    source: "检查项Fail",
    solutionPath: ["thought1", "t1"],
    granules: [
      { markCode: "MC-001A", sn: "SN20260401001", workOrder: "WO-2026-0041", failMode: "ICC2 超规格", failCondition: "高温 125°C" },
      { markCode: "MC-001B", sn: "SN20260401002", workOrder: "WO-2026-0041", failMode: "ICC2 超规格", failCondition: "常温 25°C" },
      { markCode: "MC-002C", sn: "SN20260402003", workOrder: "WO-2026-0043", failMode: "Leakage", failCondition: "高温 125°C" },
    ],
    departments: ["PTE", "CP", "DA", "EFA"],
    aiSummary: {
      progress: "已完成 ICC2 分布分析与 Pattern 定位，正在执行 EFA 物理切片验证。",
      method: "分布收敛 + Shmoo 对比 + Pattern bisect + EFA 物理分析。",
      conclusion: "初步定位为 Pattern P_ICC2_07 在低压下过激，叠加 wafer 边缘工艺偏移。",
      solution: "调整 Pattern timing margin；对边缘 die 引入 guardband 2mV。",
      risk: "若物理分析确认工艺漂移，可能需要回退至上一版本 recipe，影响交付窗口。",
    },
    tasks: [
      {
        id: "thought1",
        title: "Pattern 异常导致 ICC2 超规格",
        owner: "待指派",
        department: "PTE",
        urgency: "非常紧急",
        progress: 0,
        status: "待接受",
        children: [
          {
            id: "t1",
            code: "EA-260511000001.001",
            title: "ICC2 分布分析与 Pattern 定位",
            owner: "张伟",
            department: "PTE",
            urgency: "非常紧急",
            progress: 100,
            status: "已完成",
            conclusion: "锁定 Pattern P_ICC2_07 为主要嫌疑。",
            validity: "有效",
            site: "CP",
            siteOwner: "孙志刚",
            supervisor: "周主管",
            type: "FSA分析",
            note: "需要拉取最近 42 批次数据",
            requestedDueDate: "2026-04-21",
            dueDate: "2026-04-22",
            dueIn: 0,
            statusHistory: [
              { status: "待接受", at: "2026-04-20 10:00", by: "周主管" },
              { status: "进行中", at: "2026-04-20 15:20", by: "张伟" },
              { status: "已完成", at: "2026-04-22 16:40", by: "张伟" },
            ],
          },
          {
            id: "t1b",
            code: "EA-260511000001.002",
            title: "输出 Pattern P_ICC2_07 调整方案评审稿",
            owner: "张伟",
            department: "PTE",
            site: "CP",
            urgency: "非常紧急",
            progress: 40,
            status: "待接受",
            type: "测试程式分析",
            note: "需要整理 margin 数据",
            voiceNote: demoVoiceNote(),
            dueDate: "2026-04-23",
            dueIn: 1,
          },
          {
            id: "t1c",
            code: "EA-260511000001.007",
            title: "ICC2 温漂复测（仅 85°C 高温段）",
            owner: "刘洋",
            department: "PTE",
            site: "CP",
            urgency: "紧急",
            progress: 100,
            status: "已完成",
            conclusion: "高温段 ICC2 未见明显异常，未能复现 Pattern 漂移，该方向暂不成立。",
            validity: "无效",
            type: "测试程式分析",
            dueDate: "2026-04-24",
            dueIn: 0,
            statusHistory: [
              { status: "待接受", at: "2026-04-21 09:10", by: "周主管" },
              { status: "进行中", at: "2026-04-21 14:30", by: "刘洋" },
              { status: "已完成", at: "2026-04-24 17:05", by: "刘洋" },
            ],
          },
          {
            id: "t1c_r2",
            code: "EA-260511000001.008",
            title: "ICC2 全温域与 corner lot 扩展复测",
            owner: "刘洋",
            department: "PTE",
            site: "CP",
            urgency: "紧急",
            progress: 55,
            status: "进行中",
            expectation: "全温域 + corner lot 复测确认 ICC2 漂移是否与温度/corner 相关；若仍无异常则彻底排除该方向",
            type: "测试程式分析",
            dueDate: "2026-04-28",
            dueIn: 4,
            statusHistory: [
              { status: "待接受", at: "2026-04-24 17:20", by: "周主管" },
              { status: "进行中", at: "2026-04-25 09:40", by: "刘洋" },
            ],
          },
        ],
      },
      {
        id: "thought2",
        title: "wafer 工艺偏移导致边缘 die 异常",
        owner: "待指派",
        department: "DA",
        urgency: "紧急",
        progress: 0,
        status: "待接受",
        children: [
          {
            id: "t2",
            code: "EA-260511000001.004",
            title: "Shmoo 对比 & 边缘 die 分析",
            owner: "李娜",
            department: "DA",
            site: "CP",
            urgency: "紧急",
            progress: 65,
            status: "进行中",
            expectation: "若边缘 die VDDmin 漂移>10mV 则定位为工艺漂移，否则回到 Pattern 方向",
            type: "FSA分析",
            note: "需要按 wafer map 分组分析",
            dueDate: "2026-04-24",
            dueIn: 2,
          },
          {
            id: "t3",
            code: "EA-260511000001.005",
            title: "EFA 物理切片验证",
            owner: "陈磊",
            department: "EFA",
            urgency: "紧急",
            progress: 30,
            status: "进行中",
            conclusion: "FIB 切片未见金属层异常，SEM 成像显示边缘 die 氧化层偏薄约 4nm。",
            validity: "部分有效",
            site: "FT",
            siteOwner: "吴志强",
            supervisor: "陈主管",
            type: "FSA分析",
            note: "需要 FIB 定位和 SEM 成像",
            dueDate: "2026-04-25",
            dueIn: 3,
            children: [
              {
                id: "thought2_1",
                title: "氧化层偏薄需要调整工艺参数",
                owner: "待指派",
                department: "EFA",
                urgency: "紧急",
                progress: 0,
                status: "待接受",
                children: [
                  {
                    id: "t3c",
                    code: "EA-260511000001.003",
                    title: "同步 EFA 切片初步结论至客户沟通稿",
                    owner: "张伟",
                    department: "PTE",
                    site: "RDBI",
                    urgency: "紧急",
                    progress: 10,
                    status: "已拒绝",
                    rejectReason: "客户沟通稿应由 PM 统一口径，本任务退回，改由 PM 牵头。",
                    type: "测试代码分析",
                    note: "需要收集 EFA 当前结论",
                    dueDate: "2026-04-25",
                    dueIn: 3,
                  },
                ],
              },
            ],
          },
          {
            id: "t4",
            code: "EA-260511000001.006",
            title: "CP 测试程序 guardband 调整",
            owner: "王芳",
            department: "CP",
            site: "SLT",
            urgency: "一般",
            progress: 0,
            status: "待开始",
            expectation: "对边缘 die 引入 guardband 2mV，复测确认良率回升",
            type: "测试程式分析",
            note: "需要评审 timing margin",
            dueDate: "2026-04-28",
            dueIn: 6,
          },
        ],
      },
    ],
    timeline: [
      { time: "2026-04-22 10:24", user: "陈磊", content: "上传 FIB 切片图像 3 张，初步观察到边缘异常。" },
      { time: "2026-04-22 09:10", user: "李娜", content: "Shmoo 对比结果已上传，VDDmin 漂移 15mV。" },
      { time: "2026-04-21 18:30", user: "张伟", content: "Case 从 L5 升级至 L2，已获 PEL 审批。" },
      { time: "2026-04-20 14:00", user: "系统", content: "SPC monitor 自动关联该 Case。" },
    ],
  },
  {
    id: "c002",
    code: "EA-260511000002",
    name: "LPDDR5 FT Retest Rate 偏高",
    owner: "刘洋",
    participants: [
      { name: "赵敏", department: "FT" },
      { name: "周杰", department: "PTE" },
    ],
    level: "L3",
    urgency: "紧急",
    status: "进行中",
    reason: "FT retest 率由 1.2% 上升至 4.8%，影响产出节奏。",
    background: "近 5 天 LPDDR5 在 FT 阶段 retest 率显著上升。",
    levelReason: "跨 PTE 与 FT 部门协同，定级 L3。",
    product: "LPDDR5-7500",
    material: "LPD-B1",
    density: "12Gb",
    ioType: "x32",
    failStage: "FT",
    customer: "Customer-H",
    failPlatform: "Magnum-V",
    failMode: "Contact Fail",
    ppm: "1200",
    pdId: "PD-2026-0418",
    createdAt: "2026-04-18",
    updatedAt: "2026-04-22 08:40",
    dueIn: 5,
    departments: ["PTE", "FT"],
    aiSummary: {
      progress: "正在排查 socket 清洁周期与探针磨损。",
      method: "retest bin 分析 + socket 周期对照。",
      conclusion: "疑似 socket contact 磨损。",
      solution: "缩短清洁周期 + 更换磨损 socket。",
      risk: "更换 socket 将导致半天产出停机。",
    },
    tasks: [
      {
        id: "thought21",
        title: "Socket 磨损导致 contact fail",
        owner: "待指派",
        department: "FT",
        urgency: "紧急",
        progress: 0,
        status: "待接受",
        children: [
          {
            id: "t21",
            code: "EA-260511000002.001",
            title: "Retest bin 分布分析",
            owner: "刘洋",
            department: "PTE",
            site: "FT",
            urgency: "紧急",
            progress: 80,
            status: "进行中",
            type: "FSA分析",
            note: "分析 retest bin 集中分布情况",
            dueDate: "2026-04-23",
            dueIn: 1,
          },
          {
            id: "t22",
            code: "EA-260511000002.002",
            title: "Socket 维护记录核对",
            owner: "赵敏",
            department: "FT",
            site: "FT",
            urgency: "一般",
            progress: 40,
            status: "进行中",
            type: "FSA分析",
            note: "核对清洁周期记录",
            dueDate: "2026-04-25",
            dueIn: 3,
            children: [
              {
                id: "thought21_1",
                title: "清洁周期不足导致 contact 劣化",
                owner: "待指派",
                department: "FT",
                urgency: "紧急",
                progress: 0,
                status: "待接受",
                children: [
                  {
                    id: "t24",
                    code: "EA-260511000002.004",
                    title: "Contact 清洁周期对照实验",
                    owner: "张伟",
                    department: "PTE",
                    site: "FT",
                    urgency: "紧急",
                    progress: 0,
                    status: "待接受",
                    type: "测试程式分析",
                    note: "申请 3 套 socket 进行对照实验",
                    dueDate: "2026-04-24",
                    dueIn: 2,
                  },
                ],
              },
            ],
          },
          {
            id: "t23",
            code: "EA-260511000002.003",
            title: "支援 FT retest bin 分布复核",
            owner: "张伟",
            department: "PTE",
            site: "FT",
            urgency: "一般",
            progress: 20,
            status: "已中止",
            terminateReason: "FT 侧已自行复核完成，PTE 支援任务无需重复，终止。",
            type: "FSA分析",
            note: "比对上周数据，输出 bin 偏移表",
            dueDate: "2026-04-27",
            dueIn: 5,
          },
        ],
      },
    ],
    timeline: [
      { time: "2026-04-22 08:40", user: "刘洋", content: "retest bin 主要集中于 Bin 7，contact 类。" },
    ],
  },
  {
    id: "c003",
    code: "EA-260511000003",
    name: "SPC 自动触发：WAT Vth 漂移",
    owner: "系统自动",
    participants: [
      { name: "周宇", department: "PE" },
    ],
    level: "L4",
    urgency: "一般",
    status: "Pending",
    reason: "SPC monitor 触发，等待工程师确认归属。",
    background: "WAT Vth 连续 3 lot 超出 +2σ。",
    levelReason: "待分析影响范围，暂定 L4。",
    product: "Flash-N",
    material: "FLN-C2",
    density: "64Gb",
    ioType: "NAND",
    failStage: "WAT",
    customer: "Internal",
    failPlatform: "WAT-300",
    failMode: "Vth shift",
    ppm: "—",
    pdId: "—",
    createdAt: "2026-04-21",
    updatedAt: "2026-04-22 07:00",
    dueIn: 7,
    departments: ["PTE"],
    aiSummary: {
      progress: "Pending，等待 PEL 认领。",
      method: "—",
      conclusion: "—",
      solution: "—",
      risk: "若持续漂移，可能影响下阶段 CP 良率。",
    },
    tasks: [
      {
        id: "thought31",
        title: "工艺参数漂移导致 Vth 异常",
        owner: "待指派",
        department: "PTE",
        urgency: "一般",
        progress: 0,
        status: "待接受",
        children: [
          {
            id: "t31",
            code: "EA-260511000003.001",
            title: "认领 Pending Case 并初评影响范围",
            owner: "张伟",
            department: "PTE",
            site: "CP",
            urgency: "一般",
            progress: 0,
            status: "待接受",
            type: "FSA分析",
            note: "拉取 SPC 历史，评估影响 lot",
            dueDate: "2026-04-29",
            dueIn: 7,
          },
        ],
      },
    ],
    timeline: [{ time: "2026-04-22 07:00", user: "SPC-Bot", content: "自动创建 Pending Case。" }],
  },
  {
    id: "c004",
    code: "EA-260511000004",
    name: "站点 A 探针台校准规范更新",
    owner: "周杰",
    participants: [
      { name: "李昊", department: "PE" },
      { name: "吴迪", department: "PE" },
    ],
    level: "L5",
    urgency: "不紧急",
    status: "进行中",
    reason: "例行校准规范 SOP 更新。",
    background: "按季度更新探针台校准 SOP。",
    levelReason: "仅 PTE 内部事项，L5。",
    product: "通用",
    material: "—",
    density: "—",
    ioType: "—",
    failStage: "—",
    customer: "—",
    failPlatform: "—",
    failMode: "—",
    ppm: "—",
    pdId: "—",
    createdAt: "2026-04-10",
    updatedAt: "2026-04-21",
    dueIn: 14,
    departments: ["PTE"],
    aiSummary: {
      progress: "SOP 草案已输出。",
      method: "对照最新客户规范修订。",
      conclusion: "待评审。",
      solution: "—",
      risk: "—",
    },
    tasks: [
      {
        id: "thought41",
        title: "更新探针台校准规范以符合最新客户要求",
        owner: "待指派",
        department: "PTE",
        urgency: "不紧急",
        progress: 0,
        status: "待接受",
        children: [
          {
            id: "t41",
            code: "EA-260511000004.001",
            title: "输出 SOP 草案",
            owner: "周杰",
            department: "PTE",
            site: "CP",
            urgency: "不紧急",
            progress: 100,
            status: "已完成",
            type: "测试程式分析",
            note: "对照最新客户规范修订",
            dueDate: "2026-04-21",
            dueIn: -1,
          },
          {
            id: "t42",
            code: "EA-260511000004.002",
            title: "评审探针台校准 SOP 草案",
            owner: "张伟",
            department: "PTE",
            site: "CP",
            urgency: "不紧急",
            progress: 0,
            status: "待接受",
            type: "测试程式分析",
            note: "对照旧版 SOP，提交评审意见",
            dueDate: "2026-05-02",
            dueIn: 10,
          },
        ],
      },
    ],
    timeline: [{ time: "2026-04-21", user: "周杰", content: "提交 SOP 草案评审。" }],
  },
  {
    id: "c005",
    code: "EA-260511000005",
    name: "DDR4 Lot 退货影响分析",
    owner: "孙楠",
    participants: [
      { name: "张伟", department: "PTE" },
      { name: "王芳", department: "CP" },
      { name: "刘洋", department: "PTE" },
    ],
    level: "L1",
    urgency: "非常紧急",
    status: "进行中",
    reason: "客户退货 2 批次，需公司级评估。",
    background: "客户报告 field failure，已退货 2 批次。",
    levelReason: "影响公司层面交付与客户关系，L1 由 PM own。",
    product: "DDR4-3200",
    material: "DDR4-X",
    density: "8Gb",
    ioType: "x8",
    failStage: "Field",
    customer: "Customer-A",
    failPlatform: "—",
    failMode: "Refresh fail",
    ppm: "—",
    pdId: "PD-2026-0401",
    createdAt: "2026-04-05",
    updatedAt: "2026-04-22 11:00",
    dueIn: 1,
    departments: ["PM", "PTE", "CP", "DA", "EFA", "QA"],
    aiSummary: {
      progress: "已完成根因初判，进入客户沟通阶段。",
      method: "8D 分析 + EFA + 客户回片复测。",
      conclusion: "疑似 refresh timing margin 不足 + 特定环境触发。",
      solution: "fw patch + 新一轮 screening。",
      risk: "客户审核结果将决定是否扩大召回。",
    },
    tasks: [
      {
        id: "thought51",
        title: "Refresh timing margin 不足导致 field failure",
        owner: "待指派",
        department: "QA",
        urgency: "非常紧急",
        progress: 0,
        status: "待接受",
        children: [
          {
            id: "t52",
            code: "EA-260511000005.002",
            title: "回片复测数据汇总（PTE 配合）",
            owner: "张伟",
            department: "PTE",
            site: "RDBI",
            urgency: "非常紧急",
            progress: 55,
            status: "进行中",
            type: "FSA分析",
            note: "拉取回片 datalog，按失效模式分组",
            dueDate: "2026-04-23",
            dueIn: 1,
            children: [
              {
                id: "thought52",
                title: "需要分别从 Array 和 PTE 侧收集数据",
                owner: "待指派",
                department: "PTE",
                urgency: "非常紧急",
                progress: 0,
                status: "待接受",
                children: [
                  {
                    id: "t52a",
                    code: "EA-260511000005.002.001",
                    title: "Array 侧 bitmap 拉取",
                    owner: "周宇",
                    department: "PE-Array",
                    urgency: "非常紧急",
                    progress: 30,
                    status: "进行中",
                    type: "测试代码分析",
                    note: "Array tester 调取，bitmap 切图",
                    dueDate: "2026-04-22",
                    dueIn: 0,
                  },
                  {
                    id: "t52b",
                    code: "EA-260511000005.002.002",
                    title: "PTE 侧 datalog 整合",
                    owner: "张伟",
                    department: "PTE",
                    urgency: "非常紧急",
                    progress: 70,
                    status: "进行中",
                    type: "FSA分析",
                    note: "对齐 lot 时间戳，输出合并表",
                    dueDate: "2026-04-23",
                    dueIn: 1,
                  },
                ],
              },
            ],
          },
          {
            id: "t53",
            code: "EA-260511000005.003",
            title: "Refresh timing margin 复测",
            owner: "张伟",
            department: "PTE",
            site: "SLT",
            urgency: "紧急",
            progress: 0,
            status: "待接受",
            type: "测试程式分析",
            note: "申请测试机台，制定 margin 表",
            dueDate: "2026-04-24",
            dueIn: 2,
            children: [
              {
                id: "thought53",
                title: "Array 侧需要专项 refresh pattern 验证",
                owner: "待指派",
                department: "PE-Array",
                urgency: "紧急",
                progress: 0,
                status: "待接受",
                children: [
                  {
                    id: "t53a",
                    code: "EA-260511000005.003.001",
                    title: "Array 侧 refresh pattern 复测",
                    owner: "李昊",
                    department: "PE-Array",
                    urgency: "紧急",
                    progress: 0,
                    status: "待接受",
                    type: "测试程式分析",
                    note: "制定 pattern，执行复测",
                    dueDate: "2026-04-25",
                    dueIn: 3,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "thought54",
        title: "需要通过 8D 流程系统性分析并输出改善方案",
        owner: "待指派",
        department: "QA",
        urgency: "非常紧急",
        progress: 0,
        status: "待接受",
        children: [
          {
            id: "t51",
            code: "EA-260511000005.001",
            title: "8D 报告撰写",
            owner: "孙楠",
            department: "QA",
            site: "FT",
            urgency: "非常紧急",
            progress: 70,
            status: "进行中",
            type: "FSA分析",
            note: "按 8D 流程撰写报告",
            dueDate: "2026-04-24",
            dueIn: 2,
          },
          {
            id: "t54",
            code: "EA-260511000005.004",
            title: "PM 跨部门 8D 协调",
            owner: "孙楠",
            department: "PM",
            site: "FT",
            urgency: "非常紧急",
            progress: 60,
            status: "进行中",
            type: "FSA分析",
            note: "协调各部门完成 8D 各步骤",
            dueDate: "2026-04-26",
            dueIn: 4,
            children: [
              {
                id: "thought54_1",
                title: "8D 需要分步骤执行：D4 根因分析、D5 改善措施",
                owner: "待指派",
                department: "PM",
                urgency: "非常紧急",
                progress: 0,
                status: "待接受",
                children: [
                  {
                    id: "t54a",
                    code: "EA-260511000005.004.001",
                    title: "8D D4 根因复核（PE）",
                    owner: "吴迪",
                    department: "PE",
                    urgency: "非常紧急",
                    progress: 40,
                    status: "进行中",
                    type: "FSA分析",
                    note: "PE 侧复核根因分析",
                    dueDate: "2026-04-24",
                    dueIn: 2,
                  },
                  {
                    id: "t54b",
                    code: "EA-260511000005.004.002",
                    title: "8D D5 改善措施输出",
                    owner: "张伟",
                    department: "PTE",
                    urgency: "紧急",
                    progress: 10,
                    status: "进行中",
                    type: "FSA分析",
                    note: "收集改善项，输出计划",
                    dueDate: "2026-04-26",
                    dueIn: 4,
                    children: [
                      {
                        id: "thought54b",
                        title: "改善措施需要新的 screening pattern",
                        owner: "待指派",
                        department: "PE-Array",
                        urgency: "紧急",
                        progress: 0,
                        status: "待接受",
                        children: [
                          {
                            id: "t54b1",
                            code: "EA-260511000005.004.002.001",
                            title: "Array 侧 screening pattern 设计",
                            owner: "周宇",
                            department: "PE-Array",
                            urgency: "紧急",
                            progress: 0,
                            status: "待接受",
                            type: "测试程式分析",
                            note: "设计新的 screening pattern",
                            dueDate: "2026-04-27",
                            dueIn: 5,
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    timeline: [{ time: "2026-04-22 11:00", user: "孙楠", content: "8D D4 已完成。" }],
  },

  // —— V1.0.3 示例：DIMM 按颗粒拆分的父子 Case ——
  {
    id: "c-dimm-parent",
    code: "EA-260607000090",
    name: "DIMM 模组客退批量 FT 失效",
    owner: "张伟",
    participants: [
      { name: "赵敏", department: "FT" },
      { name: "陈磊", department: "EFA" },
    ],
    level: "L2",
    urgency: "紧急",
    status: "进行中",
    reason: "客户批量退回 DIMM 模组，FT 阶段多颗粒失效，需按颗粒拆分独立追查。",
    background:
      "北美 A 客户退回一批 DIMM 模组，经复测在 FT 阶段发现 3 类不同失效颗粒（Bit Fail / Leakage / Open），需按颗粒拆分为子 Case 分别定位。",
    impact: "影响 1 个工单约 1200 pcs 交付；客户已发预警，存在退货扩大风险。",
    levelReason: "跨部门（PTE/FT/EFA）协同且涉及客户端预警，定为 L2。",
    product: "DMJFC",
    material: "DIMM",
    density: "16Gb",
    ioType: "x8",
    failStage: "FT",
    customer: "北美 A 客户",
    failPlatform: "X86",
    failMode: "多颗粒混合失效",
    failRatio: "0.9%",
    failPackage: "FBGA",
    ppm: "1200",
    pdId: "PD-2026-0609",
    createdAt: "2026-06-07",
    updatedAt: "2026-06-08 15:20",
    dueIn: 3,
    granules: [
      { markCode: "MC-D01", sn: "SN2026DIMM001", workOrder: "WO-2026-0609", failMode: "Bit Fail", failCondition: "高温 85°C" },
      { markCode: "MC-D02", sn: "SN2026DIMM002", workOrder: "WO-2026-0609", failMode: "Leakage", failCondition: "常温 25°C" },
      { markCode: "MC-D03", sn: "SN2026DIMM003", workOrder: "WO-2026-0609", failMode: "Open", failCondition: "低温 0°C" },
    ],
    childCaseIds: ["c-dimm-child-1", "c-dimm-child-2", "c-dimm-child-3"],
    departments: ["PTE", "FT", "EFA"],
    aiSummary: {
      progress: "母案已按 3 个失效颗粒拆分为 3 个子 Case，分别推进定位。",
      method: "按颗粒拆分 + 各子案独立 FSA / 程式复核。",
      conclusion: "待各子案回收结论后于母案汇总。",
      solution: "视各子案根因分别制定改善。",
      risk: "若多颗粒同源，可能需在母案层面统一改善。",
    },
    tasks: [
      {
        id: "dimm-p-th1",
        title: "按颗粒拆分并分派子案 Owner",
        owner: "待指派",
        department: "PTE",
        urgency: "紧急",
        progress: 0,
        status: "待接受",
      },
    ],
    timeline: [
      { time: "2026-06-08 15:20", user: "张伟", content: "已按 3 个失效颗粒拆分为 3 个子 Case。" },
      { time: "2026-06-07 09:10", user: "张伟", content: "创建 DIMM 母案。" },
    ],
  },
  {
    id: "c-dimm-child-1",
    code: "EA-260607000090.C01",
    name: "DIMM 模组客退批量 FT 失效 · Bit Fail（MC-D01）",
    owner: "赵敏",
    level: "L3",
    urgency: "紧急",
    status: "进行中",
    reason: "母案拆分：定位 MC-D01 颗粒 Bit Fail 根因。",
    background: "来自母案 EA-260607000090 的颗粒 MC-D01（SN2026DIMM001），FT 高温 85°C 出现 Bit Fail。",
    impact: "单颗粒失效，需确认是否为批次共性。",
    levelReason: "单部门为主、影响有限，定为 L3。",
    product: "DMJFC",
    material: "DIMM",
    density: "16Gb",
    ioType: "x8",
    failStage: "FT",
    customer: "北美 A 客户",
    failPlatform: "X86",
    failMode: "Bit Fail",
    failRatio: "0.3%",
    failPackage: "FBGA",
    ppm: "400",
    pdId: "PD-2026-0609",
    createdAt: "2026-06-08",
    updatedAt: "2026-06-08 16:00",
    dueIn: 4,
    parentCaseId: "c-dimm-parent",
    splitGranule: { markCode: "MC-D01", sn: "SN2026DIMM001", failMode: "Bit Fail", failCondition: "高温 85°C" },
    departments: ["FT", "PTE"],
    aiSummary: {
      progress: "已接受子案，正在做 FSA 定位。",
      method: "FSA + bitmap 分析。",
      conclusion: "待 FSA 结论。",
      solution: "待定位后制定。",
      risk: "如为 array 缺陷需扩大取样。",
    },
    tasks: [
      {
        id: "dimm-c1-th",
        title: "MC-D01 Bit Fail 定位",
        owner: "待指派",
        department: "FT",
        urgency: "紧急",
        progress: 0,
        status: "待接受",
        children: [
          { id: "dimm-c1-t1", code: "EA-260607000090.C01.001", title: "FSA 定位 Bit Fail 区域", owner: "赵敏", department: "FT", urgency: "紧急", progress: 40, status: "进行中", type: "FSA分析" },
        ],
      },
    ],
    timeline: [{ time: "2026-06-08 16:00", user: "赵敏", content: "接受子案，开始 FSA。" }],
  },
  {
    id: "c-dimm-child-2",
    code: "EA-260607000090.C02",
    name: "DIMM 模组客退批量 FT 失效 · Leakage（MC-D02）",
    owner: "陈磊",
    level: "L3",
    urgency: "一般",
    status: "进行中",
    reason: "母案拆分：定位 MC-D02 颗粒 Leakage 根因。",
    background: "来自母案 EA-260607000090 的颗粒 MC-D02（SN2026DIMM002），常温 25°C 出现漏电。",
    impact: "单颗粒漏电，需确认漏电通路。",
    levelReason: "单部门为主、影响有限，定为 L3。",
    product: "DMJFC",
    material: "DIMM",
    density: "16Gb",
    ioType: "x8",
    failStage: "FT",
    customer: "北美 A 客户",
    failPlatform: "X86",
    failMode: "Leakage",
    failRatio: "0.2%",
    failPackage: "FBGA",
    ppm: "300",
    pdId: "PD-2026-0609",
    createdAt: "2026-06-08",
    updatedAt: "2026-06-08 16:10",
    dueIn: 5,
    parentCaseId: "c-dimm-parent",
    splitGranule: { markCode: "MC-D02", sn: "SN2026DIMM002", failMode: "Leakage", failCondition: "常温 25°C" },
    departments: ["EFA", "PTE"],
    aiSummary: {
      progress: "已分派 EFA，等待切片排程。",
      method: "EMMI / OBIRCH 漏电定位。",
      conclusion: "待物理分析。",
      solution: "待定位后制定。",
      risk: "切片档期可能影响进度。",
    },
    tasks: [
      {
        id: "dimm-c2-th",
        title: "MC-D02 Leakage 定位",
        owner: "待指派",
        department: "EFA",
        urgency: "一般",
        progress: 0,
        status: "待接受",
        children: [
          { id: "dimm-c2-t1", code: "EA-260607000090.C02.001", title: "EMMI 漏电点定位", owner: "陈磊", department: "EFA", urgency: "一般", progress: 0, status: "待接受", type: "FSA分析" },
        ],
      },
    ],
    timeline: [{ time: "2026-06-08 16:10", user: "陈磊", content: "已接单，等待切片排程。" }],
  },
  {
    id: "c-dimm-child-3",
    code: "EA-260607000090.C03",
    name: "DIMM 模组客退批量 FT 失效 · Open（MC-D03）",
    owner: "赵敏",
    level: "L4",
    urgency: "一般",
    status: "进行中",
    reason: "母案拆分：定位 MC-D03 颗粒 Open 根因。",
    background: "来自母案 EA-260607000090 的颗粒 MC-D03（SN2026DIMM003），低温 0°C 出现开路。",
    impact: "单颗粒开路，疑似焊接/接触问题。",
    levelReason: "影响范围小，定为 L4。",
    product: "DMJFC",
    material: "DIMM",
    density: "16Gb",
    ioType: "x8",
    failStage: "FT",
    customer: "北美 A 客户",
    failPlatform: "X86",
    failMode: "Open",
    failRatio: "0.1%",
    failPackage: "FBGA",
    ppm: "150",
    pdId: "PD-2026-0609",
    createdAt: "2026-06-08",
    updatedAt: "2026-06-08 16:20",
    dueIn: 6,
    parentCaseId: "c-dimm-parent",
    splitGranule: { markCode: "MC-D03", sn: "SN2026DIMM003", failMode: "Open", failCondition: "低温 0°C" },
    departments: ["FT"],
    aiSummary: {
      progress: "已创建，待接受。",
      method: "X-Ray + 接触电阻测量。",
      conclusion: "待检查。",
      solution: "待定位后制定。",
      risk: "如为基板问题需追溯封装。",
    },
    tasks: [
      {
        id: "dimm-c3-th",
        title: "MC-D03 Open 定位",
        owner: "待指派",
        department: "FT",
        urgency: "一般",
        progress: 0,
        status: "待接受",
        children: [
          { id: "dimm-c3-t1", code: "EA-260607000090.C03.001", title: "X-Ray 检查焊球开路", owner: "赵敏", department: "FT", urgency: "一般", progress: 0, status: "待接受", type: "SLT复现" },
        ],
      },
    ],
    timeline: [{ time: "2026-06-08 16:20", user: "张伟", content: "拆分生成子案。" }],
  },
  {
    id: "c-dimm-split",
    code: "EA-260608000091",
    name: "DIMM 内存条 SLT 复现失效",
    owner: "张伟",
    participants: [{ name: "赵敏", department: "FT" }],
    level: "L3",
    urgency: "紧急",
    status: "进行中",
    reason: "SLT 阶段多颗粒复现失效，计划按颗粒拆分为子 Case 分别定位。",
    background: "一批 DIMM 内存条在 SLT 复现出 2 类失效颗粒（Bit Fail / Timing），需按颗粒拆分独立追查。",
    impact: "影响 SLT 通过率，存在批量风险。",
    levelReason: "跨部门协同，定为 L3。",
    product: "DMJFC",
    material: "DIMM",
    density: "16Gb",
    ioType: "x8",
    failStage: "SLT",
    customer: "华东 B 客户",
    failPlatform: "ARM",
    failMode: "多颗粒失效",
    failRatio: "0.5%",
    failPackage: "FBGA",
    ppm: "600",
    pdId: "PD-2026-0608",
    createdAt: "2026-06-08",
    updatedAt: "2026-06-08 18:00",
    dueIn: 5,
    granules: [
      { markCode: "MC-E01", sn: "SN2026DIMM101", workOrder: "WO-2026-0610", failMode: "Bit Fail", failCondition: "高温 85°C" },
      { markCode: "MC-E02", sn: "SN2026DIMM102", workOrder: "WO-2026-0610", failMode: "Timing", failCondition: "低压 1.0V" },
    ],
    departments: ["PTE", "FT"],
    aiSummary: {
      progress: "待按颗粒拆分。",
      method: "按颗粒拆分 + 各子案独立分析。",
      conclusion: "待拆分后推进。",
      solution: "视根因制定。",
      risk: "若多颗粒同源需统一改善。",
    },
    tasks: [
      { id: "dimm-s-th", title: "确认失效颗粒并按颗粒拆分", owner: "待指派", department: "PTE", urgency: "紧急", progress: 0, status: "待接受" },
    ],
    timeline: [{ time: "2026-06-08 18:00", user: "张伟", content: "创建 DIMM 案，待按颗粒拆分。" }],
  },
];

// 追加更多 Case，丰富「Case 中心」全部列表与排行（轻量占位，字段齐全即可）
const mkCase = (o: {
  id: string; code: string; name: string; owner: string; level: Level; urgency: Urgency;
  status: CaseStatus; dueIn: number; createdAt: string; updatedAt: string;
  departments: string[]; participants?: Participant[];
}): CaseItem => ({
  participants: [],
  reason: "—", background: "—", levelReason: "—",
  product: "—", material: "—", density: "—", ioType: "—", failStage: "—",
  customer: "—", failPlatform: "—", failMode: "—", ppm: "—", pdId: "—",
  tasks: [],
  aiSummary: { progress: "—", method: "—", conclusion: "—", solution: "—", risk: "" },
  timeline: [],
  ...o,
});

mockCases.push(
  mkCase({ id: "c6", code: "EA-260511000006", name: "eMMC 写入寿命衰减异常分析", owner: "孙楠", level: "L1", urgency: "非常紧急", status: "已关闭", dueIn: 2, createdAt: "2026-06-01", updatedAt: "2026-06-09 09:30", departments: ["PTE", "FT", "DA"], participants: [{ name: "李娜", department: "DA" }, { name: "陈磊", department: "EFA" }, { name: "王芳", department: "CP" }, { name: "赵敏", department: "FT" }] }),
  mkCase({ id: "c7", code: "EA-260511000007", name: "WLCSP 焊球桥连失效复现", owner: "张伟", level: "L2", urgency: "紧急", status: "已关闭", dueIn: 1, createdAt: "2026-05-28", updatedAt: "2026-06-09 08:10", departments: ["PTE", "EFA"], participants: [{ name: "陈磊", department: "EFA" }, { name: "王芳", department: "CP" }] }),
  mkCase({ id: "c8", code: "EA-260511000008", name: "晶圆边缘良率衰退追因", owner: "陈磊", level: "L3", urgency: "紧急", status: "进行中", dueIn: 5, createdAt: "2026-05-30", updatedAt: "2026-06-08 16:40", departments: ["CP", "PE"], participants: [{ name: "王芳", department: "CP" }, { name: "周宇", department: "PE" }, { name: "李昊", department: "PE" }] }),
  mkCase({ id: "c9", code: "EA-260511000009", name: "划片崩裂异常追溯", owner: "孙浩", level: "L3", urgency: "一般", status: "进行中", dueIn: 3, createdAt: "2026-05-25", updatedAt: "2026-06-08 11:20", departments: ["CP", "QA"], participants: [{ name: "赵敏", department: "FT" }] }),
  mkCase({ id: "c10", code: "EA-260511000010", name: "Bump 高度 CPK 不足排查", owner: "赵敏", level: "L3", urgency: "一般", status: "进行中", dueIn: 8, createdAt: "2026-05-20", updatedAt: "2026-06-07 14:00", departments: ["PKG", "PE"], participants: [{ name: "周宇", department: "PE" }, { name: "吴迪", department: "PE" }] }),
  mkCase({ id: "c11", code: "EA-260511000011", name: "FT 工位温漂复测异常", owner: "周宇", level: "L4", urgency: "一般", status: "待处理", dueIn: 4, createdAt: "2026-06-05", updatedAt: "2026-06-08 10:05", departments: ["FT"], participants: [{ name: "赵敏", department: "FT" }] }),
  mkCase({ id: "c12", code: "EA-260511000012", name: "回流焊空洞率新案", owner: "李娜", level: "L4", urgency: "一般", status: "进行中", dueIn: 9, createdAt: "2026-06-09", updatedAt: "2026-06-09 07:50", departments: ["PKG"], participants: [{ name: "陈磊", department: "EFA" }] }),
  mkCase({ id: "c13", code: "EA-260511000013", name: "SLT 老化箱温控偏差告警", owner: "系统自动", level: "L2", urgency: "紧急", status: "待处理", dueIn: 6, createdAt: "2026-06-09", updatedAt: "2026-06-09 06:30", departments: ["SLT", "PE"], participants: [{ name: "周宇", department: "PE" }] }),
  mkCase({ id: "c14", code: "EA-260511000014", name: "探针卡磨损导致误判结案", owner: "王芳", level: "L4", urgency: "不紧急", status: "已关闭", dueIn: 0, createdAt: "2026-05-10", updatedAt: "2026-06-02 15:00", departments: ["CP"], participants: [{ name: "孙浩", department: "CP" }] }),
);

// 给所有执行任务（带 code 的动作节点）补充「预期」与「数据/附件」示例数据，
// 让思维导图卡片完整展示新版「动作 / 预期 / 结论」结构与数据区（仅在未显式提供时填充）。
(() => {
  type Att = { name: string; kind: "pdf" | "image" | "sheet" | "file" };
  const byType: Record<TaskType, Att[]> = {
    FSA分析: [
      { name: "FSA分析报告.pdf", kind: "pdf" },
      { name: "failmap.png", kind: "image" },
      { name: "bin统计.xlsx", kind: "sheet" },
    ],
    测试程式分析: [
      { name: "Pattern对比.pdf", kind: "pdf" },
      { name: "shmoo.png", kind: "image" },
      { name: "测试log.txt", kind: "file" },
    ],
    测试代码分析: [
      { name: "代码diff.pdf", kind: "pdf" },
      { name: "覆盖率.xlsx", kind: "sheet" },
    ],
    SLT复现: [
      { name: "复现记录.pdf", kind: "pdf" },
      { name: "波形.png", kind: "image" },
    ],
  };
  const fallback: Att[] = [
    { name: "分析数据.xlsx", kind: "sheet" },
    { name: "原始log.txt", kind: "file" },
  ];
  const walk = (list: TaskNode[]) => {
    for (const n of list) {
      if (n.code) {
        if (!n.expectation)
          n.expectation = `预期通过本动作确认「${n.title}」是否成立，并定位相关失效特征。`;
        if (!n.attachments) n.attachments = (n.type && byType[n.type]) || fallback;
      }
      if (n.children) walk(n.children);
    }
  };
  mockCases.forEach((c) => walk(c.tasks));
})();

export function flattenTasks(
  nodes: TaskNode[],
  depth = 0,
  parentPath: string[] = []
): { task: TaskNode; depth: number; path: string[] }[] {
  const out: { task: TaskNode; depth: number; path: string[] }[] = [];
  nodes.forEach((n) => {
    out.push({ task: n, depth, path: parentPath });
    if (n.children) out.push(...flattenTasks(n.children, depth + 1, [...parentPath, n.title]));
  });
  return out;
}

export function myTasksInCase(caseItem: CaseItem, userName: string) {
  return flattenTasks(caseItem.tasks).filter((x) => x.task.owner === userName);
}

export function suggestNextStep(task: TaskNode): string {
  if (task.status === "待接受")
    return task.recommendedActions?.[0]
      ? `先执行："${task.recommendedActions[0]}"`
      : "点击「开始任务」进入执行状态";
  if (task.status === "已中止") return "点击升级申请更多资源 / 切换至并行子任务";
  if (task.progress < 30) return "继续执行推荐动作的第一步，并上传原始数据";
  if (task.progress < 80) return "整理中间结论，补齐剩余动作与数据";
  return "撰写最终结论并提交闭环";
}

export function taskAgingHours(task: TaskNode): number {
  // mock aging hours since last state change
  const seed = task.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return (seed % 72) + 2;
}

export const notifications = [
  {
    id: "n1",
    type: "update" as const,
    user: "陈磊",
    content: "在 Case 001.003 上传了 FIB 切片图像 3 张",
    caseId: "c001",
    time: "12 分钟前",
    read: false,
  },
  {
    id: "n2",
    type: "mention" as const,
    user: "孙楠",
    content: "@你 复核 D4 根因报告",
    caseId: "c005",
    time: "38 分钟前",
    read: false,
  },
  {
    id: "n3",
    type: "escalate" as const,
    user: "系统",
    content: "Case 001.003 已被批准升级至 L2",
    caseId: "c001",
    time: "1 小时前",
    read: false,
  },
  {
    id: "n4",
    type: "spc" as const,
    user: "SPC-Bot",
    content: "WAT Vth 漂移自动创建 Pending Case",
    caseId: "c003",
    time: "2 小时前",
    read: true,
  },
  {
    id: "n5",
    type: "update" as const,
    user: "李娜",
    content: "上传了 Shmoo 对比结果，VDDmin 漂移 15mV",
    caseId: "c001",
    time: "3 小时前",
    read: true,
  },
];

export const workspaces = [
  { id: "w1", name: "PTE · DDR 工程", projects: 12, active: true },
  { id: "w2", name: "PTE · Flash 工程", projects: 8, active: false },
  { id: "w3", name: "公司级 · 质量专项", projects: 3, active: false },
];

export const currentUser = {
  name: "张伟",
  role: "PTE Engineer",
  department: "PTE",
  avatar: "Z",
};

/* =========================================================================
 * V1.0.3 领域模型：产品 · 阶段 · 项目 · Checklist · 检查项 · Issue · fanout
 * 定义层（全局固定模板） + 运行层（每产品实例） + 共性问题收敛。
 * ⚠️ 项目/检查项清单、RETs 接口、SC·FAE 现场系统名均为占位，待业务补齐后替换。
 * ========================================================================= */

// —— 定义层：阶段主干（产品级 8 段固定生命周期，有序）——
export type StageId = "DKO" | "AR" | "FVR" | "DBR" | "FSO" | "ES" | "CS" | "MP";
export interface StageDef { id: StageId; name: string; full: string; order: number }
export const STAGE_DEFS: StageDef[] = [
  { id: "DKO", name: "DKO", full: "Design Kick-off · 设计立项", order: 1 },
  { id: "AR",  name: "AR",  full: "Architecture Review · 架构评审", order: 2 },
  { id: "FVR", name: "FVR", full: "Formal Verification Review · 形式验证评审", order: 3 },
  { id: "DBR", name: "DBR", full: "Database Release · 数据库发布", order: 4 },
  { id: "FSO", name: "FSO", full: "First Silicon Out · 首片流出", order: 5 },
  { id: "ES",  name: "ES",  full: "Engineering Sample · 工程样品", order: 6 },
  { id: "CS",  name: "CS",  full: "Customer Sample · 客户样品", order: 7 },
  { id: "MP",  name: "MP",  full: "Mass Production · 量产", order: 8 },
];
export const STAGE_IDS: StageId[] = STAGE_DEFS.map((s) => s.id);
export const stageOrder = (id: StageId): number => STAGE_DEFS.find((s) => s.id === id)?.order ?? 0;
export const stageDefById = (id: StageId): StageDef => STAGE_DEFS.find((s) => s.id === id)!;

// objectType：物料/层级（可扩展）
export type ObjectType = "Wafer" | "Die" | "IC" | "DIMM";
export const OBJECT_TYPES: ObjectType[] = ["Wafer", "Die", "IC", "DIMM"];

// —— 定义层：检查项 / Checklist / 项目模板 ——
// —— 定义层：检查项 / Checklist / 项目模板 ——
// WBS 与 Checklist 融合：CheckItemDef 可递归拆解（任意层级），叶子即具体 check item。
export interface CheckItemDef { id: string; title: string; desc?: string; children?: CheckItemDef[] }
export interface ChecklistDef { id: string; name: string; stageId: StageId; items: CheckItemDef[] }
export interface ProjectTemplate {
  id: string;
  name: string;
  desc?: string;
  stageSpan: { from: StageId; to: StageId }; // 可跨阶段（单阶段则 from===to）
  checklists: ChecklistDef[];                // 一个项目多份 checklist（按阶段定位）
}

// ⚠️ 占位：固定项目模板清单（名称/跨阶段/检查项均为代表性示例，待业务补齐后替换）
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "pt-tpd", name: "测试程式开发", desc: "测试程式从 0 到 1 的开发与验证",
    stageSpan: { from: "FVR", to: "ES" },
    checklists: [
      { id: "cd-tpd-fvr", name: "程式架构评审单", stageId: "FVR", items: [
        { id: "ci-tpd-fvr-1", title: "Pattern 覆盖率 ≥ 目标" },
        { id: "ci-tpd-fvr-2", title: "Timing margin 评审通过" },
        { id: "ci-tpd-fvr-3", title: "测试项与规格逐条对齐" },
      ] },
      { id: "cd-tpd-fso", name: "首片程式验证单", stageId: "FSO", items: [
        { id: "w-fso-yield", title: "首片良率验证（WBS）", children: [
          { id: "ci-tpd-fso-1", title: "首片良率 ≥ 基线" },
        ] },
        { id: "w-fso-dist", title: "分布收敛验证（WBS）", children: [
          { id: "ci-tpd-fso-2", title: "ICC / Leakage 分布收敛" },
          { id: "ci-tpd-fso-3", title: "Shmoo 窗口充足" },
        ] },
      ] },
      { id: "cd-tpd-es", name: "工程样品程式确认单", stageId: "ES", items: [
        { id: "ci-tpd-es-1", title: "全温域复测通过" },
        { id: "ci-tpd-es-2", title: "Corner lot 验证通过" },
      ] },
    ],
  },
  {
    id: "pt-yield", name: "良率提升", desc: "从首片到量产的良率爬坡与稳定",
    stageSpan: { from: "FSO", to: "MP" },
    checklists: [
      { id: "cd-yield-fso", name: "良率基线检查单", stageId: "FSO", items: [
        { id: "ci-yield-fso-1", title: "CP1 良率 ≥ 基线" },
        { id: "ci-yield-fso-2", title: "Bin 分布无异常" },
        { id: "ci-yield-fso-3", title: "边缘 die 良率达标" },
      ] },
      { id: "cd-yield-cs", name: "量产良率稳定单", stageId: "CS", items: [
        { id: "ci-yield-cs-1", title: "连续 5 批良率稳定" },
        { id: "ci-yield-cs-2", title: "SPC 无越限" },
      ] },
    ],
  },
  {
    id: "pt-cust", name: "客户导入验证", desc: "客户样品与量产导入的可靠性验证",
    stageSpan: { from: "CS", to: "MP" },
    checklists: [
      { id: "cd-cust-cs", name: "客户样品验证单", stageId: "CS", items: [
        { id: "w-cs-compat", title: "兼容性验证（WBS）", children: [
          { id: "ci-cust-cs-1", title: "客户平台兼容性通过" },
        ] },
        { id: "w-cs-ftrel", title: "FT 复测与可靠性（WBS）", children: [
          { id: "w-cs-ft", title: "FT 复测验证（子 WBS）", children: [
            { id: "ci-cust-cs-2", title: "高低温可靠性通过" },
            { id: "ci-cust-cs-3", title: "FT Retest Rate ≤ 目标" },
          ] },
        ] },
      ] },
      { id: "cd-cust-mp", name: "量产放行单", stageId: "MP", items: [
        { id: "ci-cust-mp-1", title: "客退率 ≤ 目标" },
        { id: "ci-cust-mp-2", title: "PPM ≤ 目标" },
      ] },
    ],
  },
];
export const templateById = (id: string): ProjectTemplate | undefined => PROJECT_TEMPLATES.find((t) => t.id === id);

// —— 运行层：产品（一级实体）——
export type StageStatus = "未开始" | "进行中" | "已完成";
export type CheckState = "未开始" | "进行中" | "Pass" | "Fail" | "N/A";
export interface Product {
  id: string;
  code: string;              // 产品代号
  name: string;              // 产品名
  objectType: ObjectType;
  owner: string;             // 产品负责人（fanout 推送对象）
  currentStageId: StageId;   // 当前阶段
  stageStatus: Record<StageId, StageStatus>;
}
function stageStatusUpTo(current: StageId): Record<StageId, StageStatus> {
  const ci = stageOrder(current);
  return Object.fromEntries(
    STAGE_DEFS.map((s) => [s.id, s.order < ci ? "已完成" : s.order === ci ? "进行中" : "未开始"])
  ) as Record<StageId, StageStatus>;
}
export const mockProducts: Product[] = [
  { id: "DDR5-X-6400", code: "DDR5-X-6400", name: "DDR5 X-die 6400", objectType: "Die",  owner: "张伟", currentStageId: "FSO", stageStatus: stageStatusUpTo("FSO") },
  { id: "LPDDR5-7500", code: "LPDDR5-7500", name: "LPDDR5 7500",     objectType: "IC",   owner: "刘洋", currentStageId: "ES",  stageStatus: stageStatusUpTo("ES") },
  { id: "Flash-N",     code: "Flash-N",     name: "Flash-N NAND",    objectType: "Die",  owner: "周杰", currentStageId: "CS",  stageStatus: stageStatusUpTo("CS") },
  { id: "DDR4-3200",   code: "DDR4-3200",   name: "DDR4 3200",       objectType: "IC",   owner: "赵敏", currentStageId: "MP",  stageStatus: stageStatusUpTo("MP") },
  { id: "DMJFC",       code: "DMJFC",       name: "DMJFC 内存模组",   objectType: "DIMM", owner: "王芳", currentStageId: "MP",  stageStatus: stageStatusUpTo("MP") },
  // fanout 目标池（其它在研/量产产品）
  { id: "DDR5-X-7200", code: "DDR5-X-7200", name: "DDR5 X-die 7200", objectType: "Die",  owner: "李昊", currentStageId: "ES",  stageStatus: stageStatusUpTo("ES") },
  { id: "LPDDR5-8000", code: "LPDDR5-8000", name: "LPDDR5 8000",     objectType: "IC",   owner: "吴迪", currentStageId: "DBR", stageStatus: stageStatusUpTo("DBR") },
  { id: "DMJFD",       code: "DMJFD",       name: "DMJFD 内存模组",   objectType: "DIMM", owner: "周宇", currentStageId: "CS",  stageStatus: stageStatusUpTo("CS") },
];
export const productById = (id?: string): Product | undefined => mockProducts.find((p) => p.id === id);

// —— 运行层：项目 / Checklist / 检查项结果 ——
// WBS×Checklist 融合：CheckItemResult 可递归；状态仅在叶子有意义，父节点由 checkRollup 汇总。
// 新模型：叶子 Fail → 自动生成一个 Case（caseId），由用户再归纳进 Issue（不再直接建 Issue）。
export interface CheckItemResult { defId: string; title: string; state: CheckState; by?: string; at?: string; caseId?: string; issueId?: string; children?: CheckItemResult[] }
export interface Checklist { id: string; defId: string; name: string; stageId: StageId; items: CheckItemResult[] }
export interface Project {
  id: string;
  productId: string;
  templateId: string;
  name: string;
  stageSpan: { from: StageId; to: StageId };
  checklists: Checklist[];
}
function instantiateProject(
  id: string, productId: string, tpl: ProjectTemplate,
  overrides: Record<string, { state: CheckState; by?: string; at?: string; caseId?: string }> = {},
): Project {
  const build = (ci: CheckItemDef): CheckItemResult => {
    if (ci.children?.length) {
      return { defId: ci.id, title: ci.title, state: "未开始", children: ci.children.map(build) };
    }
    const o = overrides[ci.id];
    return { defId: ci.id, title: ci.title, state: o?.state ?? "未开始", by: o?.by, at: o?.at, caseId: o?.caseId };
  };
  return {
    id, productId, templateId: tpl.id, name: tpl.name, stageSpan: tpl.stageSpan,
    checklists: tpl.checklists.map((cd) => ({
      id: `${id}:${cd.id}`, defId: cd.id, name: cd.name, stageId: cd.stageId,
      items: cd.items.map(build),
    })),
  };
}
export const mockProjects: Project[] = [
  instantiateProject("pj-ddr5x-tpd", "DDR5-X-6400", PROJECT_TEMPLATES[0], {
    "ci-tpd-fvr-1": { state: "Pass", by: "张伟", at: "2026-03-02" },
    "ci-tpd-fvr-2": { state: "Pass", by: "张伟", at: "2026-03-05" },
    "ci-tpd-fvr-3": { state: "Pass", by: "张伟", at: "2026-03-06" },
    "ci-tpd-fso-1": { state: "Pass", by: "张伟", at: "2026-04-10" },
    "ci-tpd-fso-2": { state: "Fail", by: "张伟", at: "2026-04-15", caseId: "c001" }, // Fail → Case c001
    "ci-tpd-fso-3": { state: "进行中", by: "张伟", at: "2026-04-16" },
  }),
  instantiateProject("pj-ddr5x-yield", "DDR5-X-6400", PROJECT_TEMPLATES[1], {
    "ci-yield-fso-1": { state: "进行中", by: "王芳", at: "2026-04-18" },
    "ci-yield-fso-3": { state: "N/A" },
  }),
  instantiateProject("pj-lpddr5-tpd", "LPDDR5-7500", PROJECT_TEMPLATES[0], {
    "ci-tpd-fvr-1": { state: "Pass", by: "刘洋", at: "2026-05-02" },
    "ci-tpd-fvr-2": { state: "Pass", by: "刘洋", at: "2026-05-04" },
    "ci-tpd-fso-1": { state: "进行中", by: "刘洋", at: "2026-05-20" },
    "ci-tpd-es-1": { state: "Fail", by: "赵敏", at: "2026-06-01", caseId: "c002" }, // Fail → Case c002
  }),
  instantiateProject("pj-flash-yield", "Flash-N", PROJECT_TEMPLATES[1], {
    "ci-yield-fso-1": { state: "Pass", by: "周杰", at: "2026-02-10" },
    "ci-yield-fso-2": { state: "Fail", by: "周杰", at: "2026-02-20", caseId: "c003" }, // Fail → Case c003
    "ci-yield-cs-1": { state: "Pass", by: "周杰", at: "2026-05-11" },
  }),
  instantiateProject("pj-dmjfc-cust", "DMJFC", PROJECT_TEMPLATES[2], {
    "ci-cust-cs-1": { state: "Pass", by: "王芳", at: "2026-06-01" },
    "ci-cust-cs-3": { state: "Fail", by: "王芳", at: "2026-06-07", caseId: "c-dimm-parent" }, // Fail → Case DIMM 客退
    "ci-cust-mp-1": { state: "进行中", by: "王芳", at: "2026-06-10" },
  }),
  instantiateProject("pj-ddr4-cust", "DDR4-3200", PROJECT_TEMPLATES[2], {
    "ci-cust-cs-1": { state: "Pass", by: "赵敏", at: "2026-01-05" },
    "ci-cust-cs-2": { state: "Pass", by: "赵敏", at: "2026-01-08" },
    "ci-cust-mp-1": { state: "Fail", by: "孙楠", at: "2026-05-30", caseId: "c005" }, // Fail → Case c005
    "ci-cust-mp-2": { state: "进行中", by: "赵敏", at: "2026-06-02" },
  }),
];
export const projectsOfProduct = (productId: string): Project[] => mockProjects.filter((p) => p.productId === productId);

// —— WBS×Checklist 融合：递归树辅助（状态只在叶子，父节点汇总）——
export function checkLeaves(n: CheckItemResult): CheckItemResult[] {
  return n.children?.length ? n.children.flatMap(checkLeaves) : [n];
}
export function checklistLeaves(cl: Checklist): CheckItemResult[] {
  return cl.items.flatMap(checkLeaves);
}
export const isLeafCheck = (n: CheckItemResult): boolean => !n.children?.length;
// 节点汇总态：叶子取自身；父节点按后代叶子汇总（任一 Fail→Fail；全 Pass/N-A 且≥一 Pass→Pass；否则进行中/未开始）
export function checkRollup(n: CheckItemResult): CheckState {
  if (!n.children?.length) return n.state;
  const ls = checkLeaves(n).map((x) => x.state);
  if (ls.includes("Fail")) return "Fail";
  if (ls.every((s) => s === "Pass" || s === "N/A") && ls.some((s) => s === "Pass")) return "Pass";
  if (ls.some((s) => s === "进行中" || s === "Pass")) return "进行中";
  return "未开始";
}

// —— 收敛层：Issue（共性问题）+ fanout ——
export type IssueSource = "检查项Fail" | "MC·WBS" | "SC·FAE" | "Q·FAQA" | "手动" | "fanout验证";
export type IssueStatus = "未定位" | "调查中" | "已定位" | "已解决";
export type FanoutStatus = "待验证" | "验证中" | "已验证" | "不适用";
export interface Fanout {
  targetProductId: string;
  targetOwner: string;
  spawnedCaseCode?: string;   // fanout 派生的验证 Case 编号（原型内以编号呈现）
  status: FanoutStatus;
}
export interface IssueMemberFail { productId: string; projectId: string; checklistId: string; defId: string; title: string }
export interface Issue {
  id: string;
  code: string;               // ISS-2026xxxx
  name: string;
  source: IssueSource;
  objectType: ObjectType;
  status: IssueStatus;
  desc: string;               // 共性描述
  rootCause?: string;
  solution?: string;          // = 解题路径产出的解决方案（提交后强制 fanout + 反写 checklist）
  affectedProductIds: string[];
  memberFails: IssueMemberFail[];  // 来源①：检查项 Fail 成员
  caseIds: string[];               // 归集 / 统一调查的 Case
  fanouts: Fanout[];               // 扩散验证覆盖
  customer?: string;               // 客诉来源
  registeredBy?: string;           // 登记人（Q 部门等）
  fieldSystem?: string;            // 现场来源系统（SC·FAE 路径）
  createdAt: string;
  solvedAt?: string;
  retsSynced?: boolean;
  retsSyncedAt?: string;
  backwriteDefTitle?: string;      // 解决方案反写为新检查项的标题
}
export const mockIssues: Issue[] = [
  {
    id: "iss-ddr5-icc2", code: "ISS-20260415", name: "DDR5 X-die ICC2 分布在低压过激",
    source: "检查项Fail", objectType: "Die", status: "调查中",
    desc: "首片程式验证「ICC/Leakage 分布收敛」Fail：Pattern P_ICC2_07 在低压下过激，叠加 wafer 边缘工艺偏移。",
    rootCause: "Pattern timing margin 不足 + 边缘 die 工艺漂移",
    affectedProductIds: ["DDR5-X-6400"],
    memberFails: [{ productId: "DDR5-X-6400", projectId: "pj-ddr5x-tpd", checklistId: "pj-ddr5x-tpd:cd-tpd-fso", defId: "ci-tpd-fso-2", title: "ICC / Leakage 分布收敛" }],
    caseIds: ["c001"], fanouts: [], createdAt: "2026-04-15",
  },
  {
    id: "iss-dimm-ft", code: "ISS-20260607", name: "DMJFC 模组 FT 批量客退（Bit Fail / Leakage / Open）",
    source: "Q·FAQA", objectType: "DIMM", status: "调查中",
    desc: "北美 A 客户反馈 DMJFC 模组在 FT 高温段批量失效，含 Bit Fail、Leakage、Open 三类模式；已按颗粒拆分子 Case 并联调。",
    customer: "北美 A 客户", registeredBy: "孙楠",
    affectedProductIds: ["DMJFC"],
    memberFails: [{ productId: "DMJFC", projectId: "pj-dmjfc-cust", checklistId: "pj-dmjfc-cust:cd-cust-cs", defId: "ci-cust-cs-3", title: "FT Retest Rate ≤ 目标" }],
    caseIds: ["c-dimm-parent", "c-dimm-split"], fanouts: [], createdAt: "2026-06-07",
  },
  {
    id: "iss-lpddr5-retest", code: "ISS-20260601", name: "LPDDR5 FT Retest Rate 偏高",
    source: "MC·WBS", objectType: "IC", status: "未定位",
    desc: "MC 部门经 AVL 填报 WBS（ES~CS 窗口），经 WBS⇄EA 接口同步形成 Case，后人工归集；FT 复测率高于目标。",
    affectedProductIds: ["LPDDR5-7500"],
    memberFails: [{ productId: "LPDDR5-7500", projectId: "pj-lpddr5-tpd", checklistId: "pj-lpddr5-tpd:cd-tpd-es", defId: "ci-tpd-es-1", title: "全温域复测通过" }],
    caseIds: ["c002"], fanouts: [], createdAt: "2026-06-01",
  },
  {
    id: "iss-ddr4-vddmin", code: "ISS-20260530", name: "DDR4 客户现场 VDDmin 偏移超规",
    source: "SC·FAE", objectType: "IC", status: "已定位",
    desc: "SC·FAE 经现场系统上报，转 SAE 部门建 Case 后人工归集；客户现场 VDDmin 偏移，怀疑 PVT 覆盖不足或探针接触。",
    rootCause: "PVT 角覆盖不足", fieldSystem: "（待命名）现场系统",
    customer: "Customer-A", registeredBy: "孙楠",
    affectedProductIds: ["DDR4-3200"],
    memberFails: [{ productId: "DDR4-3200", projectId: "pj-ddr4-cust", checklistId: "pj-ddr4-cust:cd-cust-mp", defId: "ci-cust-mp-1", title: "客退率 ≤ 目标" }],
    caseIds: ["c005"], fanouts: [], createdAt: "2026-05-30",
  },
  {
    id: "iss-flash-vth", code: "ISS-20260220", name: "Flash WAT Vth 漂移 · recipe 修正",
    source: "检查项Fail", objectType: "Die", status: "已解决",
    desc: "良率基线检查「Bin 分布无异常」Fail：WAT Vth 漂移导致 Bin 分布异常。已定位为炉管温控漂移，修正 recipe 后收敛。",
    rootCause: "扩散炉管温控漂移", solution: "更新扩散 recipe 温控补偿参数，并在良率基线检查单新增「WAT Vth 漂移监控」检查项。",
    backwriteDefTitle: "WAT Vth 漂移监控",
    affectedProductIds: ["Flash-N"],
    memberFails: [{ productId: "Flash-N", projectId: "pj-flash-yield", checklistId: "pj-flash-yield:cd-yield-fso", defId: "ci-yield-fso-2", title: "Bin 分布无异常" }],
    caseIds: ["c003"],
    fanouts: [
      { targetProductId: "DDR5-X-6400", targetOwner: "张伟", spawnedCaseCode: "EA-FO-260222001", status: "已验证" },
      { targetProductId: "LPDDR5-7500", targetOwner: "刘洋", spawnedCaseCode: "EA-FO-260222002", status: "已验证" },
      { targetProductId: "DDR4-3200",   targetOwner: "赵敏", spawnedCaseCode: "EA-FO-260222003", status: "已验证" },
      { targetProductId: "DMJFC",       targetOwner: "王芳", spawnedCaseCode: "EA-FO-260222004", status: "验证中" },
      { targetProductId: "DDR5-X-7200", targetOwner: "李昊", spawnedCaseCode: "EA-FO-260222005", status: "已验证" },
      { targetProductId: "LPDDR5-8000", targetOwner: "吴迪", spawnedCaseCode: "EA-FO-260222006", status: "验证中" },
      { targetProductId: "DMJFD",       targetOwner: "周宇", spawnedCaseCode: "EA-FO-260222007", status: "已验证" },
    ],
    createdAt: "2026-02-20", solvedAt: "2026-05-12", retsSynced: true, retsSyncedAt: "2026-05-12 18:20",
  },
];

// —— 颜色 / 标签映射 ——
export const checkStateColors: Record<CheckState, string> = {
  未开始: "bg-slate-50 text-slate-500 border-slate-200",
  进行中: "bg-blue-50 text-blue-600 border-blue-200",
  Pass: "bg-emerald-50 text-emerald-600 border-emerald-200",
  Fail: "bg-red-50 text-red-600 border-red-200",
  "N/A": "bg-slate-50 text-slate-400 border-slate-200",
};
export const stageStatusColors: Record<StageStatus, string> = {
  未开始: "bg-slate-100 text-slate-400 border-slate-200",
  进行中: "bg-blue-50 text-blue-600 border-blue-200",
  已完成: "bg-emerald-50 text-emerald-600 border-emerald-200",
};
export const issueStatusColors: Record<IssueStatus, string> = {
  未定位: "bg-slate-100 text-slate-500 border-slate-200",
  调查中: "bg-blue-50 text-blue-600 border-blue-200",
  已定位: "bg-amber-50 text-amber-600 border-amber-200",
  已解决: "bg-emerald-50 text-emerald-600 border-emerald-200",
};
export const issueSourceColors: Record<IssueSource, string> = {
  检查项Fail: "bg-red-50 text-red-600 border-red-200",
  "MC·WBS": "bg-indigo-50 text-indigo-600 border-indigo-200",
  "SC·FAE": "bg-purple-50 text-purple-600 border-purple-200",
  "Q·FAQA": "bg-orange-50 text-orange-600 border-orange-200",
  手动: "bg-slate-50 text-slate-500 border-slate-200",
  fanout验证: "bg-cyan-50 text-cyan-600 border-cyan-200",
};
export const fanoutStatusColors: Record<FanoutStatus, string> = {
  待验证: "bg-slate-100 text-slate-500 border-slate-200",
  验证中: "bg-blue-50 text-blue-600 border-blue-200",
  已验证: "bg-emerald-50 text-emerald-600 border-emerald-200",
  不适用: "bg-slate-50 text-slate-400 border-slate-200",
};
export const objectTypeColors: Record<ObjectType, string> = {
  Wafer: "bg-sky-50 text-sky-600 border-sky-200",
  Die: "bg-violet-50 text-violet-600 border-violet-200",
  IC: "bg-teal-50 text-teal-600 border-teal-200",
  DIMM: "bg-amber-50 text-amber-600 border-amber-200",
};

// —— 派生：Case ↔ 产品 / Issue（case.product 现即产品代号，可直接映射）——
export const caseProductId = (c: { productId?: string; product?: string }): string | undefined =>
  c.productId ?? mockProducts.find((p) => p.id === c.product || p.code === c.product)?.id;
export const caseProductOf = (c: { productId?: string; product?: string }): Product | undefined =>
  productById(caseProductId(c));
export const issueOfCase = (caseId: string, issues: Issue[] = mockIssues): Issue | undefined =>
  issues.find((i) => i.caseIds.includes(caseId));
// 多对多：一个 Case 归属的全部 Issue（可为 0 个）
export const issuesOfCase = (caseId: string, issues: Issue[] = mockIssues): Issue[] =>
  issues.filter((i) => i.caseIds.includes(caseId));
export const casesOfIssue = (issue: Issue, cases: CaseItem[] = mockCases): CaseItem[] =>
  issue.caseIds.map((id) => cases.find((c) => c.id === id)).filter(Boolean) as CaseItem[];
export const caseSourceOf = (c: CaseItem, issues: Issue[] = mockIssues): IssueSource =>
  c.source ?? issueOfCase(c.id, issues)?.source ?? "手动";
// Issue 是否可判定为「已解决」：全部归集 Case 均已勾选解题路径
export const issueAllCasesSolved = (issue: Issue, cases: CaseItem[] = mockCases): boolean =>
  issue.caseIds.length > 0 &&
  issue.caseIds.every((id) => {
    const c = cases.find((x) => x.id === id);
    return !!c && !!c.solutionPath && c.solutionPath.length > 0;
  });
// fanout 覆盖率（已验证 / 总数）
export const fanoutCoverage = (issue: Issue): { done: number; total: number } => ({
  done: issue.fanouts.filter((f) => f.status === "已验证").length,
  total: issue.fanouts.length,
});

// —— Jira 式 Case↔Case 弱链接（多对多，仅线索，不影响 Issue 归属）——
export type CaseLinkType = "重复" | "关联" | "起因" | "阻塞";
export const CASE_LINK_TYPES: CaseLinkType[] = ["重复", "关联", "起因", "阻塞"];
export interface CaseLink { from: string; to: string; type: CaseLinkType; note?: string; byAi?: boolean }
export const caseLinkColors: Record<CaseLinkType, string> = {
  重复: "bg-red-50 text-red-600 border-red-200",
  关联: "bg-blue-50 text-blue-600 border-blue-200",
  起因: "bg-amber-50 text-amber-600 border-amber-200",
  阻塞: "bg-purple-50 text-purple-600 border-purple-200",
};
// 出边 / 入边的方向措辞（A --type--> B）
export const caseLinkPhrase: Record<CaseLinkType, { out: string; in: string }> = {
  重复: { out: "重复", in: "被重复" },
  关联: { out: "关联", in: "关联" },
  起因: { out: "起因于", in: "导致" },
  阻塞: { out: "阻塞", in: "被阻塞于" },
};
// 种子：DIMM 三个颗粒子 Case 互为「关联」，SLT 复现「重复」母案
export const mockCaseLinks: CaseLink[] = [
  { from: "c-dimm-split", to: "c-dimm-parent", type: "重复" },
  { from: "c-dimm-child-2", to: "c-dimm-child-1", type: "关联" },
];
