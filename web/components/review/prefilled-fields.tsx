"use client";
/**
 * Renders an arbitrary `prefilled_data` / payload object as a clean,
 * human-readable list of labeled fields. Replaces JSON.stringify dumps.
 */
import { User, Calendar, Building2, MapPin, FileText, Hash, Mail, Wrench, ShieldCheck, Copy } from "lucide-react";

type Value = string | number | boolean | null | undefined | Record<string, unknown> | unknown[];

const FIELD_META: Record<string, { label: string; icon?: React.ReactNode }> = {
  employee_id:      { label: "Employee ID",    icon: <Hash className="h-3.5 w-3.5" /> },
  employee_name:    { label: "Employee name",  icon: <User className="h-3.5 w-3.5" /> },
  employee_email:   { label: "Email",          icon: <Mail className="h-3.5 w-3.5" /> },
  employee_state:   { label: "State",          icon: <MapPin className="h-3.5 w-3.5" /> },
  carrier:          { label: "Carrier",        icon: <Building2 className="h-3.5 w-3.5" /> },
  coverage_line:    { label: "Coverage line",  icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  plan_type:        { label: "Plan",           icon: <FileText className="h-3.5 w-3.5" /> },
  event_type:       { label: "Event type",     icon: <Wrench className="h-3.5 w-3.5" /> },
  event_date:       { label: "Event date",     icon: <Calendar className="h-3.5 w-3.5" /> },
  election:         { label: "Election" },
  payload:          { label: "Payload" },
  employee:         { label: "Employee" },
  dependent_info:   { label: "Dependent info" },
};

const EVENT_LABEL: Record<string, string> = {
  marriage: "Marriage",
  divorce: "Divorce",
  birth_adoption: "Birth or adoption",
  death_of_dependent: "Death of dependent",
  loss_of_other_coverage: "Loss of other coverage",
  dependent_aging_off: "Dependent aging off",
};

const ELECTION_LABEL: Record<string, string> = {
  add_spouse: "Add spouse",
  add_dependent: "Add dependent",
  remove_spouse: "Remove spouse",
  remove_dependent: "Remove dependent",
  tier_change: "Change coverage tier",
  no_change: "No change",
  self_enrol: "Enroll self",
  federal_cobra: "COBRA continuation (federal)",
  nj_continuation_to_31: "NJ state continuation (to 31)",
  ny_young_adult_option_to_29: "NY Young Adult Option (to 29)",
  cal_cobra_extension: "Cal-COBRA extension",
  il_military_dependent_to_30: "IL military dependent (to 30)",
};

function humanizeKey(key: string): string {
  return FIELD_META[key]?.label || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatScalar(key: string, value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "event_type") return EVENT_LABEL[String(value)] || String(value);
  if (key === "choice" || key === "election") return ELECTION_LABEL[String(value)] || String(value);
  if (key === "coverage_line") return String(value).charAt(0).toUpperCase() + String(value).slice(1);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "event_date" || key === "elected_at" || key.endsWith("_at")) {
    const d = new Date(String(value));
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
    }
  }
  return String(value);
}

export function PrefilledFields({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data || {});
  if (entries.length === 0) {
    return <div className="text-sm text-muted italic">No data.</div>;
  }
  return (
    <div className="divide-y divide-[var(--color-border)] border border-default rounded-lg overflow-hidden">
      {entries.map(([key, value]) => (
        <Row key={key} k={key} v={value as Value} />
      ))}
    </div>
  );
}

function Row({ k, v }: { k: string; v: Value }) {
  const meta = FIELD_META[k];
  const label = humanizeKey(k);

  if (v === null || v === undefined || v === "") {
    return <FieldRow icon={meta?.icon} label={label} value={<span className="text-muted-2">—</span>} />;
  }

  if (typeof v === "object" && !Array.isArray(v)) {
    return (
      <div className="px-4 py-3 bg-surface-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted font-semibold mb-2">
          {meta?.icon}
          <span>{label}</span>
        </div>
        <div className="bg-surface rounded-md border border-default">
          {Object.entries(v as Record<string, unknown>).map(([nk, nv]) => (
            <Row key={nk} k={nk} v={nv as Value} />
          ))}
        </div>
      </div>
    );
  }

  if (Array.isArray(v)) {
    return (
      <FieldRow
        icon={meta?.icon}
        label={label}
        value={
          v.length === 0 ? <span className="text-muted-2">—</span> :
          <div className="flex flex-wrap gap-1">
            {v.map((item, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-surface-2 border border-default">
                {typeof item === "object" ? JSON.stringify(item) : String(item)}
              </span>
            ))}
          </div>
        }
      />
    );
  }

  return <FieldRow icon={meta?.icon} label={label} value={formatScalar(k, v)} copyable />;
}

function FieldRow({
  icon, label, value, copyable,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  copyable?: boolean;
}) {
  return (
    <div className="grid grid-cols-[180px_1fr_auto] gap-3 px-4 py-2.5 items-start group">
      <div className="flex items-center gap-2 text-xs text-muted">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm text-ink-2 min-w-0 break-words">
        {value}
      </div>
      {copyable && typeof value === "string" && (
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(value)}
          className="opacity-0 group-hover:opacity-100 text-muted-2 hover:text-ink transition-opacity p-1"
          title="Copy"
        >
          <Copy className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
