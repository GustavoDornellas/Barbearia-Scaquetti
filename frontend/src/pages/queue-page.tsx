import { FormEvent, useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { PageHeader } from "../components/ui/page-header";
import { StatCard } from "../components/ui/stat-card";
import { StatusBadge } from "../components/ui/status-badge";
import { api, getFriendlyError } from "../services/api";
import { useToastStore } from "../store/toast-store";

type QueueItem = {
  id: string;
  status: "WAITING" | "CALLED" | "IN_SERVICE" | "FINISHED" | "CANCELLED";
  estimatedMinutes: number;
  serviceDuration: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  canCallNext: boolean;
  serviceLabel: string;
  scheduledFor: string;
  paidAmount?: number | null;
  whatsapp?: string | null;
  client: { id: string; name: string };
  barber?: { name: string };
};

type FlowTrendPoint = {
  label: string;
  count: number;
  percentage: number;
};

const emptyFlowTrend: FlowTrendPoint[] = ["08H", "10H", "12H", "15H", "18H", "20H"].map((label) => ({
  label,
  count: 0,
  percentage: 0
}));

export function QueuePage() {
  const notify = useToastStore((state) => state.notify);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [savedStyles, setSavedStyles] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("barbearia:service-styles");
      return stored ? JSON.parse(stored) : ["Corte degradê", "Corte navalhado", "Corte + barba", "Barba"];
    } catch {
      return ["Corte degradê", "Corte navalhado", "Corte + barba", "Barba"];
    }
  });
  const [newStyleInput, setNewStyleInput] = useState("");
  const [showNewStyleInput, setShowNewStyleInput] = useState(false);
  const [summary, setSummary] = useState({
    attendedToday: 0,
    revenueToday: 0,
    averageWaitMinutes: 0,
    canCallNext: false,
    callNextAvailableInMinutes: null as number | null
  });
  const [flowTrend, setFlowTrend] = useState<FlowTrendPoint[]>(emptyFlowTrend);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ clientId: "", serviceLabel: "", serviceDuration: "", scheduledTime: "" });
  const [finishItem, setFinishItem] = useState<QueueItem | null>(null);
  const [finishAmount, setFinishAmount] = useState("");
  const [clientsLoading, setClientsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  function saveStyles(styles: string[]) {
    setSavedStyles(styles);
    localStorage.setItem("barbearia:service-styles", JSON.stringify(styles));
  }

  function addNewStyle() {
    const trimmed = newStyleInput.trim();
    if (!trimmed) return;
    if (!savedStyles.includes(trimmed)) {
      saveStyles([...savedStyles, trimmed]);
    }
    setForm({ ...form, serviceLabel: trimmed });
    setNewStyleInput("");
    setShowNewStyleInput(false);
  }

  function selectStyle(style: string) {
    setForm({ ...form, serviceLabel: style });
  }

  function formatQueueTime(value: string) {
    return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function isFutureQueueTime(value: string) {
    return new Date(value).getTime() > Date.now();
  }

  async function loadQueue(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const queueResponse = await api.get("/queue");
      setItems(queueResponse.data.data.items);
      setSummary(queueResponse.data.data.summary);
    } catch (error) {
      notify(getFriendlyError(error), "error");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function loadClients() {
    if (clients.length > 0 || clientsLoading) return;

    setClientsLoading(true);
    try {
      const clientsResponse = await api.get("/clients");
      setClients(clientsResponse.data.data.items);
    } catch (error) {
      notify(getFriendlyError(error), "error");
    } finally {
      setClientsLoading(false);
    }
  }

  async function loadFlowTrend() {
    try {
      const response = await api.get("/dashboard/flow-trend");
      setFlowTrend(response.data.data.buckets ?? emptyFlowTrend);
    } catch (error) {
      notify(getFriendlyError(error), "error");
    }
  }

  useEffect(() => {
    loadQueue();
    loadClients();
    loadFlowTrend();
    const interval = window.setInterval(() => {
      loadQueue(false);
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  async function openQueueForm() {
    setFormOpen(true);
    await loadClients();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.clientId || !form.serviceLabel.trim()) {
      notify("Selecione o cliente e informe o corte.", "error");
      return;
    }
    const serviceDuration = Number(form.serviceDuration);
    if (Number.isNaN(serviceDuration) || serviceDuration < 5) {
      notify("Informe um tempo de pelo menos 5 minutos.", "error");
      return;
    }
    try {
      setActionLoading("submit");
      await api.post("/queue", { ...form, serviceDuration });
      notify("Cliente adicionado a fila.", "success");
      setFormOpen(false);
      setForm({ clientId: "", serviceLabel: "", serviceDuration: "", scheduledTime: "" });
      await loadQueue(false);
    } catch (error) {
      notify(getFriendlyError(error), "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function callClient() {
    const whatsappWindow = window.open("", "_blank");

    try {
      setActionLoading("call");
      const response = await api.post("/queue/call-next");
      const link = response.data.data.whatsapp;
      if (link && whatsappWindow) {
        whatsappWindow.location.href = link;
      } else if (link) {
        window.open(link, "_blank");
      } else {
        whatsappWindow?.close();
      }
      notify("Cliente chamado.", "success");
      await loadQueue(false);
    } catch (error) {
      whatsappWindow?.close();
      notify(getFriendlyError(error), "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function advanceClient(id: string) {
    const whatsappWindow = window.open("", "_blank");

    try {
      setActionLoading(`advance-${id}`);
      const response = await api.post(`/queue/${id}/advance`);
      const link = response.data.data.whatsapp;
      if (link && whatsappWindow) {
        whatsappWindow.location.href = link;
      } else if (link) {
        window.open(link, "_blank");
      } else {
        whatsappWindow?.close();
      }
      notify(link ? "Mensagem de adiantamento aberta no WhatsApp." : "Corte adiantado, mas cliente sem telefone valido.", "success");
      await loadQueue(false);
    } catch (error) {
      whatsappWindow?.close();
      notify(getFriendlyError(error), "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function startService(id: string) {
    try {
      setActionLoading(`start-${id}`);
      await api.post(`/queue/${id}/start`);
      notify("Atendimento iniciado.", "success");
      await loadQueue(false);
    } catch (error) {
      notify(getFriendlyError(error), "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function updateStatus(id: string, status: QueueItem["status"]) {
    try {
      setActionLoading(`status-${id}`);
      await api.patch(`/queue/${id}/status`, { status });
      notify("Fila atualizada.", "success");
      await loadQueue(false);
    } catch (error) {
      notify(getFriendlyError(error), "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function finishService(event: FormEvent) {
    event.preventDefault();
    if (!finishItem) return;
    const amount = Number(finishAmount);
    if (Number.isNaN(amount) || amount < 0) {
      notify("O valor nao pode ser negativo.", "error");
      return;
    }

    try {
      setActionLoading(`finish-${finishItem.id}`);
      await api.post(`/queue/${finishItem.id}/finish`, { amount });
      notify("Atendimento finalizado e valor somado.", "success");
      setFinishItem(null);
      setFinishAmount("");
      await loadQueue(false);
    } catch (error) {
      notify(getFriendlyError(error), "error");
    } finally {
      setActionLoading(null);
    }
  }

  const peakTrend = flowTrend.reduce<FlowTrendPoint | null>((peak, point) => {
    if (!peak || point.count > peak.count) return point;
    return peak;
  }, null);
  const hasFlowTrendData = flowTrend.some((point) => point.count > 0);
  const hasWaitingClient = items.some((item) => item.status === "WAITING");
  const hasCalledClient = items.some((item) => item.status === "CALLED");
  const hasInServiceClient = items.some((item) => item.status === "IN_SERVICE");

  function getStatusTone(status: QueueItem["status"]): "gold" | "green" | "red" | "gray" {
    if (status === "IN_SERVICE" || status === "CALLED") return "gold";
    if (status === "WAITING") return "gray";
    if (status === "FINISHED") return "green";
    return "red";
  }

  function getStatusLabel(status: QueueItem["status"]) {
    if (status === "IN_SERVICE") return "Em atendimento";
    if (status === "CALLED") return "Chamado";
    if (status === "WAITING") return "Aguardando";
    if (status === "FINISHED") return "Finalizado";
    return "Cancelado";
  }

  function getCallNextLabel(item: QueueItem) {
    if (hasCalledClient) return "Cliente ja chamado";
    if (summary.canCallNext) return "Chamar proximo";
    const minutes = summary.callNextAvailableInMinutes ?? Math.max(0, item.remainingMinutes - 10);
    return `Chamar proximo em ${minutes} min`;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Fila de Espera"
        description="Quem está na fila e tempo de espera"
        actions={
          <>
            <Button variant="secondary" onClick={() => loadQueue()}>Atualizar</Button>
            {hasWaitingClient && !hasInServiceClient && !hasCalledClient ? (
              <Button variant="secondary" onClick={() => callClient()} disabled={actionLoading === "call"}>
                {actionLoading === "call" ? "Chamando..." : "Chamar proximo"}
              </Button>
            ) : null}
            <Button onClick={() => openQueueForm()}>Adicionar na Fila</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Atendidos hoje" value={String(summary.attendedToday)} hint="Finalizados hoje" />
        <StatCard label="Faturamento hoje" value={`R$ ${summary.revenueToday.toFixed(2)}`} hint="Atendimentos finalizados" />
        <StatCard label="Tempo até o próximo cliente" value={`${summary.averageWaitMinutes} min`} hint="Soma do tempo da fila" />
      </div>

      <section className="space-y-4">
        {loading && items.length === 0 ? (
          <div className="rounded-[28px] border border-border bg-panel p-6 text-sm text-muted">Carregando fila...</div>
        ) : items.length === 0 ? (
          <div className="rounded-[28px] border border-border bg-panel p-6 text-sm text-muted">Fila vazia.</div>
        ) : (
          <>
            {loading ? (
              <div className="rounded-[28px] border border-border bg-panel p-4 text-sm text-muted">Atualizando fila...</div>
            ) : null}
            {items.map((item) => (
          <div key={item.id} className="rounded-[28px] border border-border bg-panel p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-semibold">{item.client.name}</h3>
                  <StatusBadge tone={getStatusTone(item.status)}>{getStatusLabel(item.status)}</StatusBadge>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {item.serviceLabel} - {item.serviceDuration} min - horario {formatQueueTime(item.scheduledFor)}
                </p>
                {item.status === "CALLED" ? (
                  <p className="mt-3 text-sm font-semibold text-gold">Aguardando chegada</p>
                ) : null}
                {item.status === "IN_SERVICE" ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-border bg-background px-3 py-1 text-muted">
                      Decorrido: <strong className="text-text">{item.elapsedMinutes} min</strong>
                    </span>
                    <span className="rounded-full border border-border bg-background px-3 py-1 text-muted">
                      Restante: <strong className="text-gold">{item.remainingMinutes} min</strong>
                    </span>
                    {item.canCallNext ? (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-300">
                        Pode chamar o proximo
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="mr-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Espera</p>
                  <p className="font-semibold text-gold">{item.status === "CALLED" ? "Chamado" : `${item.estimatedMinutes} min`}</p>
                </div>
                {item.status === "WAITING" && isFutureQueueTime(item.scheduledFor) ? (
                  <Button variant="secondary" onClick={() => advanceClient(item.id)} disabled={actionLoading === `advance-${item.id}`}>
                    {actionLoading === `advance-${item.id}` ? "Adiantando..." : "Adiantar"}
                  </Button>
                ) : null}
                {item.status === "CALLED" ? (
                  <Button onClick={() => startService(item.id)} disabled={actionLoading === `start-${item.id}`}>
                    {actionLoading === `start-${item.id}` ? "Iniciando..." : "Iniciar atendimento"}
                  </Button>
                ) : null}
                {item.status === "IN_SERVICE" && hasWaitingClient ? (
                  <Button
                    onClick={() => callClient()}
                    disabled={!summary.canCallNext || actionLoading === "call"}
                    title={summary.canCallNext ? "Chamar proximo cliente" : "Liberado quando faltar 10 minutos ou menos no atendimento atual"}
                  >
                    {actionLoading === "call" ? "Chamando..." : getCallNextLabel(item)}
                  </Button>
                ) : null}
                {item.status === "IN_SERVICE" ? <Button onClick={() => { setFinishItem(item); setFinishAmount(""); }}>Finalizar</Button> : null}
                {["WAITING", "CALLED", "IN_SERVICE"].includes(item.status) ? (
                  <Button variant="secondary" onClick={() => updateStatus(item.id, "CANCELLED")} disabled={actionLoading === `status-${item.id}`}>
                    {actionLoading === `status-${item.id}` ? "Cancelando..." : "Cancelar"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
            ))}
          </>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-[28px] border border-border bg-panel p-6 shadow-panel">
          <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full border-[10px] border-gold/10" />
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">Dica rápida</p>
          <h2 className="mt-4 max-w-sm text-2xl font-bold leading-tight">Evite deixar a cadeira parada</h2>
          <p className="mt-5 max-w-md text-sm leading-6 text-muted">
            Deixe tudo pronto para atender um cliente logo após o outro.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-border bg-panel p-6 shadow-panel">
          <div className="absolute -right-4 -top-8 h-24 w-16 rotate-12 rounded-full bg-gold/10" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Tendência de fluxo</h2>
              <p className="mt-1 text-xs text-muted">Horários mais movimentados (últimos 30 dias)</p>
            </div>
            {hasFlowTrendData ? (
              <div className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
                Pico {peakTrend?.label}
              </div>
            ) : null}
          </div>
          <div className="mt-7">
            <div className="relative flex h-32 items-end justify-between gap-3 border-b border-white/10 pb-6">
              <div className="absolute inset-x-0 top-1/3 border-t border-dashed border-white/10" />
              <div className="absolute inset-x-0 top-2/3 border-t border-dashed border-white/10" />
              {flowTrend.map((point) => (
                <div key={point.label} className="relative z-10 flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[10px] font-bold text-gold">
                    {point.count > 0 ? point.count : ""}
                  </span>
                  <div className="flex h-20 w-full items-end">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-gold/35 via-gold/70 to-gold shadow-[0_0_24px_rgba(216,177,93,0.18)]"
                      title={`${point.count} atendimento${point.count !== 1 ? "s" : ""}`}
                      style={{ height: `${Math.max(point.percentage, point.count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-muted">{point.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted">
              <span>Mais vazio</span>
              <span>Mais movimento</span>
            </div>
          </div>
        </div>
      </section>

      {formOpen && (
        <form onSubmit={submit} className="fixed inset-0 z-50 flex items-end bg-black/60 p-4 md:items-center md:justify-center">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[28px] border border-border bg-panel p-6 shadow-panel">
            <h2 className="text-lg font-bold">Adicionar na fila</h2>
            <select value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })} className="mt-4 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold">
              <option value="">{clientsLoading ? "Carregando clientes..." : "Selecione o cliente"}</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>

            <div className="mt-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-gold/80">Estilo do corte</p>
              <div className="flex flex-wrap gap-2">
                {savedStyles.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => selectStyle(style)}
                    className={`rounded-2xl border px-3 py-2 text-sm transition-colors ${
                      form.serviceLabel === style
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border bg-background text-muted hover:border-gold/50"
                    }`}
                  >
                    {style}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowNewStyleInput(!showNewStyleInput)}
                  className="rounded-2xl border border-dashed border-border bg-background px-3 py-2 text-sm text-muted hover:border-gold/50"
                >
                  + Novo estilo
                </button>
              </div>
              {showNewStyleInput && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={newStyleInput}
                    onChange={(e) => setNewStyleInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNewStyle())}
                    placeholder="Digite o estilo do corte"
                    className="flex-1 rounded-2xl border border-border bg-background px-4 py-2 text-sm outline-none focus:border-gold"
                    autoFocus
                  />
                  <Button type="button" onClick={addNewStyle}>Adicionar</Button>
                  <Button type="button" variant="secondary" onClick={() => { setShowNewStyleInput(false); setNewStyleInput(""); }}>Fechar</Button>
                </div>
              )}
              {form.serviceLabel ? (
                <p className="mt-2 text-xs text-muted">Selecionado: <span className="text-gold font-semibold">{form.serviceLabel}</span></p>
              ) : null}
            </div>
            <input type="number" min="5" value={form.serviceDuration} onChange={(event) => setForm({ ...form, serviceDuration: event.target.value })} placeholder="Tempo em minutos" className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold" />
            <label className="mt-4 block text-xs font-bold uppercase tracking-[0.22em] text-gold/80">Horario do corte</label>
            <input
              type="time"
              value={form.scheduledTime}
              onChange={(event) => setForm({ ...form, scheduledTime: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold"
            />
            <p className="mt-2 text-xs leading-5 text-muted">
              Opcional. Use quando o cliente vai entrar mais tarde, por exemplo as 15:00.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={actionLoading === "submit"}>
                {actionLoading === "submit" ? "Adicionando..." : "Adicionar"}
              </Button>
            </div>
          </div>
        </form>
      )}

      {finishItem && (
        <form onSubmit={finishService} className="fixed inset-0 z-50 flex items-end bg-black/60 p-4 md:items-center md:justify-center">
          <div className="w-full max-w-md rounded-[28px] border border-border bg-panel p-6 shadow-panel">
            <h2 className="text-lg font-bold">Finalizar atendimento</h2>
            <p className="mt-2 text-sm text-muted">{finishItem.client.name} - {finishItem.serviceLabel}</p>
            <input
              type="number"
              min="0"
              step="0.01"
              value={finishAmount}
              onChange={(event) => setFinishAmount(event.target.value)}
              placeholder="Valor do corte"
              className="mt-4 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold"
            />
            <div className="mt-5 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setFinishItem(null)}>Cancelar</Button>
              <Button type="submit" disabled={actionLoading === `finish-${finishItem.id}`}>
                {actionLoading === `finish-${finishItem.id}` ? "Finalizando..." : "Finalizar e somar"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
