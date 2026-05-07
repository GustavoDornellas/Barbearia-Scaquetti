import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useAuthStore } from "../store/auth-store";
import { useCsrf } from "../hooks/use-csrf";
import { getFriendlyError } from "../services/api";
import { useToastStore } from "../store/toast-store";

export function LoginPage() {
  useCsrf();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const notify = useToastStore((state) => state.notify);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    sessionStorage.removeItem("authUser");
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      notify("Login realizado com sucesso.", "success");
      navigate("/", { replace: true });
    } catch (error) {
      notify(getFriendlyError(error), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(216,177,93,0.18),_transparent_25%),_#121212] px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-[32px] border border-border bg-panel p-8 shadow-panel">
        <div className="flex flex-col items-center text-center">
          <div className="overflow-hidden rounded-3xl border border-gold/30 bg-black shadow-[0_0_45px_rgba(216,177,93,0.12)]">
            <img
              src="/logo-barbearia-scaquetti.jpg"
              alt="Logo Barbearia Scaquetti"
              className="h-24 w-24 object-cover"
            />
          </div>
          <div className="mt-5">
            <p className="text-2xl font-extrabold leading-none">Barbearia</p>
            <p className="mt-1 text-2xl font-extrabold leading-none text-gold">Scaquetti</p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold"
            placeholder="E-mail"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold"
            placeholder="Senha"
          />
        </div>
        <Button type="submit" className="mt-6 w-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
