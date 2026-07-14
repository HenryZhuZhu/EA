import { Mic, Square, Play, Pause, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Synthesize a short WAV tone as a data URL — used as a fallback "recording"
// when a real microphone isn't available (e.g. opening the offline file://).
// This guarantees the prototype always has a playable clip to demonstrate.
function synthWavDataUrl(seconds = 2, sampleRate = 8000): string {
  const dur = Math.max(0.6, Math.min(seconds, 8));
  const n = Math.floor(dur * sampleRate);
  const dataSize = n * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let p = 0;
  const wstr = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i)); };
  const u32 = (v: number) => { view.setUint32(p, v, true); p += 4; };
  const u16 = (v: number) => { view.setUint16(p, v, true); p += 2; };
  wstr("RIFF"); u32(36 + dataSize); wstr("WAVE");
  wstr("fmt "); u32(16); u16(1); u16(1); u32(sampleRate); u32(sampleRate * 2); u16(2); u16(16);
  wstr("data"); u32(dataSize);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t * 4, (dur - t) * 4);
    // wobble the frequency a bit so it reads as a "voice memo" rather than a flat beep
    const freq = 200 + 60 * Math.sin(2 * Math.PI * 1.5 * t);
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.22 * env;
    view.setInt16(p, sample * 32767, true); p += 2;
  }
  let bin = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(bin);
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---- Recorder: records a clip and returns it as a data URL ----
export function VoiceRecorder({
  value,
  onChange,
  compact = false,
}: {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  compact?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<number | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (recording) {
      timer.current = window.setInterval(() => setElapsed((e) => e + 1), 1000) as any;
    } else if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [recording]);

  const cleanupStream = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  const start = async () => {
    setElapsed(0);
    chunks.current = [];
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const mr = new MediaRecorder(s);
      recorder.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => onChange(reader.result as string);
        reader.readAsDataURL(blob);
        cleanupStream();
      };
      mr.start();
      setRecording(true);
    } catch {
      // No mic / insecure context — simulate recording, synthesize a clip on stop.
      recorder.current = null;
      setRecording(true);
    }
  };

  const stop = () => {
    setRecording(false);
    if (recorder.current && recorder.current.state !== "inactive") {
      recorder.current.stop();
    } else {
      // simulated fallback
      onChange(synthWavDataUrl(elapsed || 2));
    }
  };

  if (value && !recording) {
    return (
      <div className="flex items-center gap-2">
        <VoicePlayer src={value} />
        <button
          type="button"
          onClick={() => onChange(undefined)}
          title="删除录音"
          className="h-7 w-7 shrink-0 rounded-md border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-300 flex items-center justify-center"
        >
          <Trash2 size={12} />
        </button>
        <button
          type="button"
          onClick={start}
          title="重新录制"
          className="h-7 px-2 shrink-0 rounded-md border border-slate-200 text-slate-500 hover:text-[#0052D9] hover:border-[#0052D9]/40 inline-flex items-center gap-1 text-[11px]"
        >
          <Mic size={11} /> 重录
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => (recording ? stop() : start())}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border transition-all text-xs ${
        compact ? "h-7 px-2.5" : "h-8 px-3"
      } ${
        recording
          ? "bg-red-500 border-red-500 text-white animate-pulse"
          : "bg-white border-slate-200 text-slate-600 hover:border-[#0052D9]/40 hover:text-[#0052D9]"
      }`}
    >
      {recording ? <Square size={12} /> : <Mic size={12} />}
      {recording ? `录音中 ${fmt(elapsed)} · 点击停止` : "录制语音"}
    </button>
  );
}

// ---- Player: plays a data URL clip ----
export function VoicePlayer({ src, label = "语音" }: { src: string; label?: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [dur, setDur] = useState(0);
  const [cur, setCur] = useState(0);

  useEffect(() => {
    const a = new Audio(src);
    audio.current = a;
    const onMeta = () => setDur(isFinite(a.duration) ? a.duration : 0);
    const onTime = () => setCur(a.currentTime);
    const onEnd = () => { setPlaying(false); setCur(0); };
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.pause();
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, [src]);

  const toggle = (e: any) => {
    e.stopPropagation();
    const a = audio.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;

  return (
    <div className="inline-flex items-center gap-2 h-7 px-2 rounded-md bg-[#0052D9]/5 border border-[#0052D9]/20 text-[#0052D9] max-w-[180px]">
      <button type="button" onClick={toggle} className="shrink-0 hover:opacity-80" title={playing ? "暂停" : "播放"}>
        {playing ? <Pause size={13} /> : <Play size={13} />}
      </button>
      <div className="flex items-center gap-1.5 min-w-0">
        <Mic size={11} className="shrink-0 opacity-70" />
        <div className="h-1 w-16 bg-[#0052D9]/15 rounded overflow-hidden">
          <div className="h-full bg-[#0052D9] rounded" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] tabular-nums shrink-0">{fmt(dur || 0)}</span>
      </div>
    </div>
  );
}
