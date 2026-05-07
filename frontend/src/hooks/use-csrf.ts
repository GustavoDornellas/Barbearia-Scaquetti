import { useEffect } from "react";
import { api } from "../services/api";

export function useCsrf() {
  useEffect(() => {
    api.get("/auth/csrf-token")
      .then((response) => {
        localStorage.setItem("csrfToken", response.data.data.csrfToken);
      })
      .catch(() => {
        localStorage.removeItem("csrfToken");
      });
  }, []);
}
