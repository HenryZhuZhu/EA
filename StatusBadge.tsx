import { Circle, Clock, CircleDot, CheckCheck, XCircle, Ban } from "lucide-react";

/**
 * 任务状态徽章 —— 全项目统一（方案 B · 收敛配色）
 * 颜色只给最常被扫视的两个状态：进行中＝淡蓝、已完成＝淡绿；
 * 其余一律中性灰，靠图标形状区分；已拒绝＝纯灰图标（无底，弱化）。
 */

const ICON = {
  待开始: Circle,
  待接受: Clock,
  进行中: CircleDot,
  已完成: CheckCheck,
  已拒绝: XCircle,
  已中止: Ban,
} as const;

// 圆形徽章底色（方案 B：仅进行中/已完成着色）
const BG: Record<string, string> = {
  进行中: "bg-blue-50 text-blue-600",
  已完成: "bg-emerald-50 text-emerald-600",
  待开始: "bg-slate-100 text-slate-500",
  待接受: "bg-slate-100 text-slate-500",
  已中止: "bg-slate-100 text-slate-500",
};

export function StatusBadge({ status, size = 18 }: { status: string; size?: number }) {
  const Icon = (ICON as Record<string, typeof Circle>)[status] || Circle;
  const icon = Math.round(size * 0.62);

  // 已拒绝：纯灰图标、无底（弱化）
  if (status === "已拒绝") {
    return (
      <span
        title={`状态：${status}`}
        className="inline-flex items-center justify-center shrink-0 text-slate-400"
        style={{ width: size, height: size }}
      >
        <Icon size={icon + 2} strokeWidth={2} />
      </span>
    );
  }

  return (
    <span
      title={`状态：${status}`}
      className={`inline-flex items-center justify-center rounded-full shrink-0 ${BG[status] || "bg-slate-100 text-slate-500"}`}
      style={{ width: size, height: size }}
    >
      <Icon size={icon} strokeWidth={2.4} />
    </span>
  );
}
