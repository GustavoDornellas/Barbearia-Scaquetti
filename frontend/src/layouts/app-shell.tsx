import { PropsWithChildren } from "react";
import { Bell, Search } from "lucide-react";
import { Sidebar } from "../components/sidebar";
import { useAuthStore } from "../store/auth-store";

export function AppShell({ children }: PropsWithChildren) {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-screen bg-background text-text lg:flex">
      <Sidebar />
      <div className="flex-1">
        <header className="border-b border-border px-5 py-4 lg:px-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-panel px-4 py-3 lg:w-[420px]">
              <Search className="h-4 w-4 text-muted" />
              <input
                className="w-full border-none bg-transparent text-sm text-text outline-none placeholder:text-muted"
                placeholder="Buscar cliente ou serviço..."
              />
            </div>
            <div className="flex items-center gap-4">
              <button className="rounded-2xl border border-border bg-panel p-3">
                <Bell className="h-4 w-4 text-muted" />
              </button>
              <div className="text-right">
                <div className="text-sm font-semibold">{user?.name ?? "Usuário"}</div>
              </div>
              <img
                src="/logo-barbearia-scaquetti.jpg"
                alt="Avatar do usuário"
                className="h-11 w-11 rounded-2xl border border-gold/30 object-cover"
              />
            </div>
          </div>
        </header>
        <main className="px-5 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
