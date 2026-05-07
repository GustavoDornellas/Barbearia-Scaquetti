import { create } from "zustand";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

type ToastState = {
  toasts: Toast[];
  notify: (message: string, type?: ToastType) => void;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  notify: (message, type = "info") => {
    let id = "";
    let shouldScheduleDismiss = true;

    set((state) => {
      const duplicatedToast = state.toasts.find((toast) => toast.message === message && toast.type === type);
      if (duplicatedToast) {
        id = duplicatedToast.id;
        shouldScheduleDismiss = false;
        return state;
      }

      id = crypto.randomUUID();
      return { toasts: [...state.toasts.slice(-4), { id, type, message }] };
    });

    if (!shouldScheduleDismiss) return;

    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    }, 4500);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
}));
