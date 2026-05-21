import { PropsWithChildren } from "react";
import { Sidebar } from "../components/sidebar";
import { useAuthStore } from "../store/auth-store";

export function AppShell({ children }: PropsWithChildren) {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-screen bg-background text-text lg:flex">
      <Sidebar />
      <div className="flex-1">
        <header className="border-b border-border px-5 py-4 lg:px-10">
          <div className="flex items-center justify-end gap-4">
            <div className="text-right">
              <div className="text-sm font-semibold">{user?.name ?? "Usuário"}</div>
            </div>
            <img
              src="/logo-barbearia-scaquetti.jpg"
              alt="Avatar do usuário"
              className="h-11 w-11 rounded-2xl border border-gold/30 object-cover"
            />
          </div>
        </header>
        <main className="px-5 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
