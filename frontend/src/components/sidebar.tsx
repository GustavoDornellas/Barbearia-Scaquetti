import { useState } from "react";
import { CalendarRange, LayoutDashboard, LogOut, Menu, Package, Users, X } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth-store";
import { useToastStore } from "../store/toast-store";

const navItems = [
  { label: "Início", to: "/", icon: LayoutDashboard },
  { label: "Agendamentos", to: "/agendamentos", icon: CalendarRange },
  { label: "Clientes", to: "/clientes", icon: Users },
  { label: "Estoque", to: "/estoque", icon: Package }
];

export function Sidebar() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const notify = useToastStore((state) => state.notify);
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await logout();
    notify("Você saiu do sistema.", "success");
    navigate("/login", { replace: true });
  }

  function close() {
    setOpen(false);
  }

  const sidebarContent = (
    <>
      <div className="mb-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="overflow-hidden rounded-2xl border border-gold/30 bg-black">
            <img
              src="/logo-barbearia-scaquetti.jpg"
              alt="Logo Barbearia Scaquetti"
              className="h-12 w-12 object-cover"
            />
          </div>
          <div>
            <div className="text-lg font-bold">Barbearia</div>
            <div className="text-lg font-bold text-gold">Scaquetti</div>
          </div>
        </div>
        {/* Botão fechar — só no mobile */}
        <button
          onClick={close}
          className="lg:hidden rounded-xl border border-border bg-panel p-2 text-muted hover:text-text"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={close}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                  isActive ? "bg-white/10 text-gold" : "text-muted hover:bg-white/5 hover:text-text"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto rounded-3xl border border-border bg-panel p-4">
        <p className="text-sm font-semibold text-text">Chamada pelo WhatsApp</p>
        <p className="mt-2 text-xs leading-6 text-muted">
          A fila já cria a mensagem com o tempo de espera.
        </p>
      </div>
      <button
        onClick={handleLogout}
        className="mt-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-muted transition hover:bg-white/5 hover:text-text"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </>
  );

  return (
    <>
      {/* ── DESKTOP: sidebar fixa ── */}
      <aside className="hidden lg:flex lg:min-h-screen lg:w-[260px] flex-col border-r border-border bg-[#0d0d0d] px-5 py-8">
        {sidebarContent}
      </aside>

      {/* ── MOBILE: overlay + drawer ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-border bg-[#0d0d0d] px-5 py-8 transition-transform duration-300 lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Botão hambúrguer — exportado para o AppShell via prop não — fica aqui mesmo como botão flutuante mobile */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed left-4 top-4 z-30 lg:hidden flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-panel text-muted shadow-lg transition hover:text-text ${open ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>
    </>
  );
}
