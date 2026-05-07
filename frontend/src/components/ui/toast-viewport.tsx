import clsx from "clsx";
import { useToastStore } from "../../store/toast-store";

export function ToastViewport() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className="fixed right-4 top-4 z-50 w-[min(360px,calc(100vw-2rem))] space-y-3">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className={clsx(
            "w-full rounded-2xl border px-4 py-3 text-left text-sm shadow-panel",
            toast.type === "success" && "border-success/40 bg-success/15 text-text",
            toast.type === "error" && "border-danger/40 bg-danger/15 text-text",
            toast.type === "info" && "border-border bg-panel text-text"
          )}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
