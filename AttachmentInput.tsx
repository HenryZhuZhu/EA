import { Paperclip, X, FileText, FileImage, FileSpreadsheet, File as FileIcon } from "lucide-react";
import { useRef } from "react";

export type Att = { name: string; kind: "pdf" | "image" | "sheet" | "file"; url?: string };

function kindOf(file: File): Att["kind"] {
  const t = file.type;
  const n = file.name.toLowerCase();
  if (t.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(n)) return "image";
  if (t === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (/\.(csv|xlsx?|numbers)$/.test(n) || t.includes("sheet") || t.includes("excel")) return "sheet";
  return "file";
}

function AttIcon({ kind }: { kind: Att["kind"] }) {
  if (kind === "pdf") return <FileText size={12} className="text-rose-500" />;
  if (kind === "image") return <FileImage size={12} className="text-sky-500" />;
  if (kind === "sheet") return <FileSpreadsheet size={12} className="text-emerald-500" />;
  return <FileIcon size={12} className="text-slate-400" />;
}

// 附件上传：支持图片/文件，图片读为 dataURL 以便预览（原型本地存储）
export function AttachmentInput({
  value = [],
  onChange,
  compact = false,
  variant = "full",
}: {
  value?: Att[];
  onChange: (next: Att[]) => void;
  compact?: boolean;
  variant?: "full" | "icon" | "chips";
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    Promise.all(
      arr.map(
        (f) =>
          new Promise<Att>((resolve) => {
            const kind = kindOf(f);
            if (kind === "image") {
              const reader = new FileReader();
              reader.onloadend = () => resolve({ name: f.name, kind, url: reader.result as string });
              reader.readAsDataURL(f);
            } else {
              resolve({ name: f.name, kind });
            }
          })
      )
    ).then((atts) => onChange([...value, ...atts]));
  };

  if (variant === "icon") {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          title="上传附件"
          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 hover:text-[#0052D9] hover:border-[#0052D9]/50 transition-all shrink-0"
        >
          <Paperclip size={12} />
        </button>
      </>
    );
  }

  if (variant === "chips") {
    if (value.length === 0) return null;
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {value.map((a, i) => (
          <span
            key={i}
            title={a.name}
            className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded bg-white border border-slate-200 text-[11px] text-slate-600 max-w-[160px]"
          >
            {a.url && a.kind === "image" ? (
              <img src={a.url} alt={a.name} className="w-4 h-4 rounded object-cover shrink-0" />
            ) : (
              <AttIcon kind={a.kind} />
            )}
            <span className="truncate">{a.name}</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="shrink-0 text-slate-300 hover:text-red-500"
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((a, i) => (
          <span
            key={i}
            title={a.name}
            className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded bg-white border border-slate-200 text-[11px] text-slate-600 max-w-[160px]"
          >
            {a.url && a.kind === "image" ? (
              <img src={a.url} alt={a.name} className="w-4 h-4 rounded object-cover shrink-0" />
            ) : (
              <AttIcon kind={a.kind} />
            )}
            <span className="truncate">{a.name}</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="shrink-0 text-slate-300 hover:text-red-500"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 text-slate-500 hover:border-[#0052D9]/50 hover:text-[#0052D9] transition-colors ${
            compact ? "h-7 px-2 text-[11px]" : "h-8 px-2.5 text-xs"
          }`}
        >
          <Paperclip size={12} /> 上传附件
        </button>
      </div>
    </div>
  );
}
