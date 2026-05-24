"use client";
import { useRef, useState, useCallback } from "react";
import { Upload, File as FileIcon, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FileInfo = { name: string; size: number; type: string };

const ACCEPTED = [".pdf", ".jpg", ".jpeg", ".png"];
const MAX_SIZE = 10 * 1024 * 1024;

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FileDrop({
  value, onChange, demoSamples,
}: {
  value: FileInfo | null;
  onChange: (info: FileInfo | null) => void;
  demoSamples?: { fname: string; outcome: string; tone: "success" | "warning" | "danger" }[];
}) {
  const [hover, setHover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSamples, setShowSamples] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setError(null);
    const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      setError(`File type ${ext} isn't supported. Use PDF, JPG, or PNG.`);
      return;
    }
    if (f.size > MAX_SIZE) {
      setError("File is too large. Max 10 MB.");
      return;
    }
    onChange({ name: f.name, size: f.size, type: f.type });
  }, [onChange]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setHover(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  }

  function pickSample(fname: string) {
    onChange({ name: fname, size: 245 * 1024, type: "application/pdf" });
    setShowSamples(false);
  }

  if (value) {
    return (
      <div className="rounded-xl border border-default bg-surface p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-brand-soft flex items-center justify-center shrink-0">
            <FileIcon className="h-4 w-4 text-[var(--color-brand)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-ink truncate">{value.name}</div>
            <div className="text-xs text-muted">{humanSize(value.size)} · ready to submit</div>
          </div>
          <CheckCircle2 className="h-4 w-4 text-[var(--color-success)] shrink-0" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="p-1.5 rounded-md hover:bg-surface-2 text-muted-2 hover:text-ink"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setHover(true); }}
        onDragLeave={() => setHover(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative rounded-xl border-2 border-dashed cursor-pointer transition-all p-8 text-center",
          hover ? "border-[var(--color-brand)] bg-brand-soft" : "border-[var(--color-border-strong)] bg-surface-2/40 hover:bg-surface-2"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <div className="mx-auto h-10 w-10 rounded-full bg-surface flex items-center justify-center mb-3 border border-default">
          <Upload className="h-4 w-4 text-[var(--color-brand)]" />
        </div>
        <p className="text-sm font-medium text-ink">
          Drop your document here, or <span className="text-[var(--color-brand)]">browse</span>
        </p>
        <p className="text-xs text-muted mt-1">PDF, JPG, or PNG up to 10 MB</p>
      </div>

      {error && <p className="text-xs text-[var(--color-danger)] mt-2">{error}</p>}

      {demoSamples && demoSamples.length > 0 && (
        <div className="mt-3 relative">
          <button
            type="button"
            onClick={() => setShowSamples((v) => !v)}
            className="text-xs text-muted-2 hover:text-ink underline decoration-dotted underline-offset-4"
          >
            Demo: try a sample file →
          </button>
          {showSamples && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowSamples(false)}
              />
              <div className="absolute left-0 top-full mt-2 z-20 w-[320px] card-elevated p-2 animate-fade-in">
                <div className="text-[10px] uppercase tracking-wider text-muted-2 px-2 py-1">
                  Sample documents (prototype only)
                </div>
                {demoSamples.map((s) => (
                  <button
                    type="button"
                    key={s.fname}
                    onClick={() => pickSample(s.fname)}
                    className="w-full text-left px-2 py-2 rounded-md hover:bg-surface-2"
                  >
                    <div className="font-mono text-xs text-ink truncate">{s.fname}</div>
                    <div className="text-[11px] text-muted">{s.outcome}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
