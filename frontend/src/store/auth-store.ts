import { create } from "zustand";
import { api } from "../services/api";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
};

let hydrationPromise: Promise<void> | null = null;

function getStoredUser() {
  try {
    const stored = sessionStorage.getItem("authUser");
    return stored ? (JSON.parse(stored) as User) : null;
  } catch {
    sessionStorage.removeItem("authUser");
    return null;
  }
}

function persistUser(user: User | null) {
  if (user) {
    sessionStorage.setItem("authUser", JSON.stringify(user));
    return;
  }

  sessionStorage.removeItem("authUser");
}

const storedUser = getStoredUser();

export const useAuthStore = create<AuthState>((set) => ({
  user: storedUser,
  isAuthenticated: Boolean(storedUser),
  loading: false,
  login: async (email, password) => {
    localStorage.removeItem("csrfToken");
    persistUser(null);
    set({ user: null, isAuthenticated: false });

    const csrfResponse = await api.get("/auth/csrf-token");
    const csrfToken = csrfResponse.data.data.csrfToken;
    localStorage.setItem("csrfToken", csrfToken);

    const response = await api.post("/auth/login", { email, password }, {
      headers: { "X-CSRF-Token": csrfToken }
    });
    persistUser(response.data.data.user);
    set({
      user: response.data.data.user,
      isAuthenticated: true
    });
  },
  hydrate: async () => {
    const current = useAuthStore.getState();
    if (current.isAuthenticated && current.user) {
      set({ loading: false });
      return;
    }

    if (hydrationPromise) {
      return hydrationPromise;
    }

    set({ loading: true });
    hydrationPromise = (async () => {
      try {
        const csrfResponse = await api.get("/auth/csrf-token");
        localStorage.setItem("csrfToken", csrfResponse.data.data.csrfToken);
        const response = await api.get("/auth/me");
        persistUser(response.data.data.user);
        set({ user: response.data.data.user, isAuthenticated: true });
      } catch {
        persistUser(null);
        set({ user: null, isAuthenticated: false });
      } finally {
        set({ loading: false });
        hydrationPromise = null;
      }
    })();

    return hydrationPromise;
  },
  logout: async () => {
    await api.post("/auth/logout");
    localStorage.removeItem("csrfToken");
    persistUser(null);
    set({ user: null, isAuthenticated: false });
  }
}));
