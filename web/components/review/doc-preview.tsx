/**
 * Mocked document preview. Renders a stylised "scanned certificate" look
 * driven by the QLE's event type. The numbers/names come from the
 * review-mock enrichment helper. Replace with a real PDF/image viewer
 * when documents are stored as bytes on the backend.
 */
import { FileText, Stamp, ImageOff } from "lucide-react";
import type { ReviewEnrichment } from "@/lib/review-mock";

const TINT: Record<ReviewEnrichment["doc"]["previewKind"], string> = {
  marriage_certificate: "bg-pastel-lavender",
  birth_certificate:    "bg-pastel-sky",
  divorce_decree:       "bg-pastel-cream",
  death_certificate:    "bg-surface-2",
  coverage_loss_letter: "bg-pastel-mint",
  wedding_invitation:   "bg-pastel-pink",
  rejected:             "bg-pastel-peach",
  unknown:              "bg-surface-2",
};

export function DocPreview({
  enrichment,
  filename,
}: {
  enrichment: ReviewEnrichment;
  filename: string;
}) {
  const { doc } = enrichment;
  const isInvitation = doc.previewKind === "wedding_invitation";
  const isRejected = doc.previewKind === "rejected";

  return (
    <div className="space-y-3">
      <div
        className={
          "relative aspect-[8.5/11] border border-default rounded-xl overflow-hidden " +
          "shadow-[0_1px_2px_rgba(16,16,24,0.04),0_8px_24px_-8px_rgba(16,16,24,0.10)]"
        }
      >
        <div className={`absolute inset-0 ${TINT[doc.previewKind]}`} />

        {isInvitation ? (
          <InvitationBody doc={doc} />
        ) : (
          <CertificateBody doc={doc} rejected={isRejected} />
        )}
      </div>

      {/* Filename strip */}
      <div className="flex items-center justify-between text-xs text-muted-2 px-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="font-mono truncate">{filename}</span>
        </div>
        <div className="shrink-0">
          {(doc.sizeKb / 1024).toFixed(1)} MB · {doc.pages} page{doc.pages > 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}

function CertificateBody({
  doc, rejected,
}: {
  doc: ReviewEnrichment["doc"];
  rejected: boolean;
}) {
  return (
    <>
      <div className="absolute top-6 right-6 h-16 w-16 rounded-full border-2 border-[var(--color-brand)]/30 flex items-center justify-center opacity-50">
        <Stamp className="h-7 w-7 text-[var(--color-brand)]/60" />
      </div>

      <div className="relative h-full p-8 flex flex-col">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-2/70 font-semibold">
          {doc.previewIssuer}
        </div>
        <div className="text-xl font-semibold tracking-tight text-ink mt-3 leading-tight">
          {doc.previewTitle}
        </div>

        <div className="h-px bg-ink/10 my-5" />

        <div className="space-y-3 text-sm">
          <Row k="Document no." v={`VR-${(doc.sizeKb * 13).toString(36).slice(0, 8).toUpperCase()}`} />
          <Row k="Subject" v={doc.previewSubject} />
          <Row k="Date of record" v={doc.previewDate} />
          <Row k="Issued on" v={doc.previewDate} />
        </div>

        <div className="mt-auto pt-6">
          {rejected ? (
            <div className="flex items-center gap-2 text-[var(--color-danger)] text-xs font-medium">
              <ImageOff className="h-4 w-4" />
              This document failed automated validation.
            </div>
          ) : (
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted">Signed by</div>
                <div className="font-[cursive] text-lg leading-none mt-2 text-ink-2 italic">
                  {scribble(doc.previewIssuer)}
                </div>
                <div className="text-[10px] text-muted mt-1">Registrar of Vital Records</div>
              </div>
              <div className="text-[10px] text-muted-2 text-right">
                Page 1 of {doc.pages}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function InvitationBody({ doc }: { doc: ReviewEnrichment["doc"] }) {
  // The two names that would appear on a wedding invitation
  const [a, b] = (doc.previewSubject.split(" and ").map((s) => s.trim()));
  return (
    <div className="relative h-full p-10 flex flex-col items-center justify-center text-center">
      <div className="text-[10px] uppercase tracking-[0.3em] text-ink-2/60 mb-6">
        Together with their families
      </div>

      <div className="font-serif italic text-2xl text-ink-2 leading-tight">
        {a || "—"}
      </div>
      <div className="text-sm text-ink-2/60 my-2">&amp;</div>
      <div className="font-serif italic text-2xl text-ink-2 leading-tight">
        {b || "—"}
      </div>

      <div className="text-[10px] uppercase tracking-[0.3em] text-ink-2/60 mt-8 mb-2">
        request the pleasure of your company
      </div>

      <div className="font-serif text-base text-ink-2 mb-1">{doc.previewDate}</div>
      <div className="text-xs text-ink-2/70">Reception to follow</div>

      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-2 text-[var(--color-danger)] text-xs font-medium">
        <ImageOff className="h-4 w-4" />
        Not a marriage certificate — please upload the official document.
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <div className="text-muted text-xs uppercase tracking-wider">{k}</div>
      <div className="text-ink-2">{v}</div>
    </div>
  );
}

function scribble(seed: string): string {
  // Pick an initials-style cursive based on issuer name
  const parts = seed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return "M. Reyes";
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}
