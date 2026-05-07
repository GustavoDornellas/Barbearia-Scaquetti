import { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
};

export function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <div className="rounded-[28px] border border-border bg-panel p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.24em] text-muted">{label}</span>
        {icon}
      </div>
      <div className="text-3xl font-bold text-text">{value}</div>
      {hint ? <p className="mt-2 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

