import clsx from "clsx";

type StatusBadgeProps = {
  tone: "gold" | "green" | "red" | "gray";
  children: string;
};

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return (
    <span
      className={clsx("rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]", {
        "bg-gold/20 text-gold": tone === "gold",
        "bg-success/20 text-success": tone === "green",
        "bg-danger/20 text-danger": tone === "red",
        "bg-white/5 text-muted": tone === "gray"
      })}
    >
      {children}
    </span>
  );
}

