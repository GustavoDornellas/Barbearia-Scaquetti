import axios from "axios";
import { useToastStore } from "../store/toast-store";

const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");

if (!apiBaseUrl) {
  throw new Error("VITE_API_URL nao configurada.");
}

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true
});

function persistCsrfToken(token?: string) {
  if (token) {
    localStorage.setItem("csrfToken", token);
  }
}

async function refreshCsrfToken() {
  const response = await api.get("/auth/csrf-token");
  const csrfToken = response.data?.data?.csrfToken;
  persistCsrfToken(csrfToken);
  return csrfToken;
}

api.interceptors.request.use((config) => {
  const csrf = localStorage.getItem("csrfToken");

  if (csrf) {
    config.headers["X-CSRF-Token"] = csrf;
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    persistCsrfToken(response.headers["x-csrf-token"]);
    return response;
  },
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    persistCsrfToken(error.response?.headers?.["x-csrf-token"]);

    // Se o próprio refresh falhou com 403, sessão expirou — redireciona para login
    if (status === 403 && original?.url?.includes("/auth/refresh")) {
      useToastStore.getState().notify("Sessão expirada. Entre de novo.", "error");
      window.location.href = "/login";
      throw error;
    }

    // 401 em qualquer rota que não seja login/refresh — tenta renovar o token
    if (status === 401 && !original._retry && !original.url?.includes("/auth/login") && !original.url?.includes("/auth/refresh")) {
      original._retry = true;
      try {
        await api.post("/auth/refresh");
        return api(original);
      } catch {
        useToastStore.getState().notify("Entre de novo para continuar.", "error");
        window.location.href = "/login";
      }
    }

    // 403 em outras rotas — tenta renovar CSRF e retentar uma vez
    if (status === 403 && !original?._csrfRetry) {
      original._csrfRetry = true;
      try {
        const csrfToken = await refreshCsrfToken();
        original.headers = original.headers ?? {};
        original.headers["X-CSRF-Token"] = csrfToken;
        return api(original);
      } catch {
        // Se falhar, redireciona para login se não estiver nele
        if (!original?.url?.includes("/auth/login")) {
          useToastStore.getState().notify("Sessão expirada. Entre de novo.", "error");
          window.location.href = "/login";
        }
      }
    }

    if (status === 429) useToastStore.getState().notify("Muitas tentativas. Espere um pouco e tente de novo.", "error");
    if (status >= 500) useToastStore.getState().notify("Não deu para concluir agora. Tente de novo em instantes.", "error");

    throw error;
  }
);

export function getFriendlyError(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 429) {
      return "Muitas tentativas. Espere um pouco e tente de novo.";
    }

    if (error.response?.status === 403) {
      if (error.config?.url?.includes("/auth/login")) {
        return "Atualize a página e tente entrar de novo.";
      }

      return "Entre de novo para continuar.";
    }

    const apiError = error.response?.data?.error;
    if (typeof apiError === "string" && !apiError.includes("Exception")) {
      return apiError;
    }

    return "Não deu para concluir. Tente de novo.";
  }

  return "Não deu para concluir. Tente de novo.";
}

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: string;
};
