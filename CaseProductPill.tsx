import { Package } from "lucide-react";
import { caseProductOf } from "./data";

type CaseProductRef = {
  productId?: string;
  product?: string;
};

export function CaseProductPill({ caseItem, compact = false }: { caseItem?: CaseProductRef | null; compact?: boolean }) {
  const product = caseItem ? caseProductOf(caseItem) : undefined;
  const rawCode = product?.code || caseItem?.product;
  const code = rawCode && rawCode !== "—" ? rawCode : "未关联产品";

  return (
    <span
      title={`产品：${code}`}
      className={`inline-flex items-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 font-medium shrink-0 whitespace-nowrap ${compact ? "gap-0.5 px-1.5 py-0.5 text-[9px] leading-none" : "gap-1 px-2 py-0.5 text-[10px]"}`}
    >
      <Package size={compact ? 9 : 10} strokeWidth={2} />
      {code}
    </span>
  );
}
