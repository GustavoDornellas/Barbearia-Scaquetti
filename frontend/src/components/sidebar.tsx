import { CalendarRange, LayoutDashboard, LogOut, Package, Users } from "lucide-react";
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

  async function handleLogout() {
    await logout();
    notify("Você saiu do sistema.", "success");
    navigate("/login", { replace: true });
  }

  return (
    <aside className="flex min-h-screen w-full flex-col border-r border-border bg-[#0d0d0d] px-5 py-8 lg:w-[260px]">
      <div className="mb-10 flex items-center gap-3">
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

      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
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
    </aside>
  );
}
