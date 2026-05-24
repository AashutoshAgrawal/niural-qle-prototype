import { User, Cake, Heart, Hash, MapPin, ShieldCheck } from "lucide-react";
import type { DependentClaim } from "@/lib/review-mock";

export function DependentCard({ dep }: { dep: DependentClaim }) {
  const rows = [
    { icon: <User className="h-3.5 w-3.5" />, k: "Name", v: dep.name },
    { icon: <Heart className="h-3.5 w-3.5" />, k: "Relationship", v: dep.relationship },
    { icon: <Cake className="h-3.5 w-3.5" />, k: "Date of birth", v: `${dep.dob}${dep.age > 0 ? ` · ${dep.age} yrs` : " · newborn"}` },
    { icon: <Hash className="h-3.5 w-3.5" />, k: "SSN", v: dep.ssnLast4 },
    { icon: <MapPin className="h-3.5 w-3.5" />, k: "State", v: dep.state },
    { icon: <ShieldCheck className="h-3.5 w-3.5" />, k: "Other coverage", v: dep.otherCoverage ? "Yes" : "No (employee declared)" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {rows.map((r) => (
        <div key={r.k} className="flex items-start gap-2">
          <div className="text-muted-2 mt-0.5">{r.icon}</div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted">{r.k}</div>
            <div className="text-sm font-medium text-ink truncate">{r.v}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
