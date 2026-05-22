import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/ui/page-header";
import { StatCard } from "../components/ui/stat-card";
import { api, ApiEnvelope, getFriendlyError } from "../services/api";
import { useToastStore } from "../store/toast-store";

type CashClosingData = {
  date: string;
  summary: {
    totalAppointments: number;
    revenueAppointments: number;
    totalProductsSold: number;
    revenueProducts: number;
    totalRevenue: number;
  };
  appointments: Array<{ time: string; client: string; service: string; price: number }>;
  products: Array<{ name: string; brand: string; quantity: number; unitPrice: number; total: number }>;
};

type HistoryData = {
  days: Array<{
    date: string;
    dateFormatted: string;
    appointments: number;
    revenueAppointments: number;
    revenueProducts: number;
    productsSold: number;
    total: number;
  }>;
};

type MonthlyData = {
  monthName: string;
  year: number;
  month: number;
  summary: {
    workedDays: number;
    totalClients: number;
    averageTicket: number;
    revenueAppointments: number;
    revenueProducts: number;
    totalRevenue: number;
  };
  bestDay: { date: string; revenue: number } | null;
  worstDay: { date: string; revenue: number } | null;
  topServices: Array<{ label: string; count: number }>;
};

type DashboardData = {
  revenueToday: number;
  totalClients: number;
  averageTicket: number;
  productsSoldToday: number;
  queueCount: number;
  weeklyRevenue: Array<{ day: string; value: number }>;
  popularProducts: Array<{ label: string; count: number; percentage: number }>;
  recentActivities: Array<{
    id: string;
    clientName: string;
    serviceLabel: string;
    price: number;
    finishedAt: string;
    status: string;
  }>;
  flowTrend?: {
    buckets: Array<{ label: string; count: number; percentage: number }>;
    peakLabel: string | null;
  };
};

let cachedDashboardData: DashboardData | null = null;

export function DashboardPage() {
  const notify = useToastStore((state) => state.notify);
  const [data, setData] = useState<DashboardData | null>(cachedDashboardData);
  const [loading, setLoading] = useState(!cachedDashboardData);
  const [cashClosingOpen, setCashClosingOpen] = useState(false);
  const [cashClosingDate, setCashClosingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cashClosingData, setCashClosingData] = useState<CashClosingData | null>(null);
  const [cashClosingLoading, setCashClosingLoading] = useState(false);

  // Histórico
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Relatório mensal
  const [monthlyOpen, setMonthlyOpen] = useState(false);
  const [monthlyYear, setMonthlyYear] = useState(() => new Date().getFullYear());
  const [monthlyMonth, setMonthlyMonth] = useState(() => new Date().getMonth() + 1);
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  async function openHistory() {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const response = await api.get("/dashboard/closing-history?months=3");
      setHistoryData(response.data.data);
    } catch (error) {
      notify(getFriendlyError(error), "error");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openMonthly() {
    setMonthlyOpen(true);
    await loadMonthly(monthlyYear, monthlyMonth);
  }

  async function loadMonthly(year: number, month: number) {
    setMonthlyLoading(true);
    try {
      const response = await api.get(`/dashboard/monthly-report?year=${year}&month=${month}`);
      setMonthlyData(response.data.data);
    } catch (error) {
      notify(getFriendlyError(error), "error");
    } finally {
      setMonthlyLoading(false);
    }
  }

  function exportMonthlyToCSV() {
    if (!monthlyData) return;
    const fmt = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
    let csv = `RELATÓRIO MENSAL;${monthlyData.monthName}\n\n`;
    csv += `RESUMO\n`;
    csv += `Dias trabalhados;${monthlyData.summary.workedDays}\n`;
    csv += `Total de clientes;${monthlyData.summary.totalClients}\n`;
    csv += `Ticket médio;${fmt(monthlyData.summary.averageTicket)}\n`;
    csv += `Receita de cortes;${fmt(monthlyData.summary.revenueAppointments)}\n`;
    csv += `Receita de produtos;${fmt(monthlyData.summary.revenueProducts)}\n`;
    csv += `TOTAL DO MÊS;${fmt(monthlyData.summary.totalRevenue)}\n\n`;
    if (monthlyData.bestDay) csv += `Melhor dia;${monthlyData.bestDay.date};${fmt(monthlyData.bestDay.revenue)}\n`;
    if (monthlyData.worstDay) csv += `Pior dia;${monthlyData.worstDay.date};${fmt(monthlyData.worstDay.revenue)}\n`;
    csv += `\nSERVIÇOS MAIS REALIZADOS\n`;
    csv += `Serviço;Quantidade\n`;
    for (const s of monthlyData.topServices) csv += `${s.label};${s.count}\n`;
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-${monthlyYear}-${String(monthlyMonth).padStart(2, "0")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function openCashClosing() {
    setCashClosingOpen(true);
    await loadCashClosing(cashClosingDate);
  }

  async function loadCashClosing(date: string) {
    setCashClosingLoading(true);
    try {
      const response = await api.get(`/dashboard/cash-closing?date=${date}`);
      setCashClosingData(response.data.data);
    } catch (error) {
      notify(getFriendlyError(error), "error");
    } finally {
      setCashClosingLoading(false);
    }
  }

  function exportToExcel() {
    if (!cashClosingData) return;

    const fmt = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8"/></head>
      <body>
        <table>
          <tr><td colspan="2"><b>FECHAMENTO DE CAIXA — ${cashClosingData.date}</b></td></tr>
          <tr><td></td></tr>
          <tr><td><b>RESUMO</b></td></tr>
          <tr><td>Atendimentos realizados</td><td>${cashClosingData.summary.totalAppointments}</td></tr>
          <tr><td>Receita de atendimentos</td><td>${fmt(cashClosingData.summary.revenueAppointments)}</td></tr>
          <tr><td>Produtos vendidos</td><td>${cashClosingData.summary.totalProductsSold}</td></tr>
          <tr><td>Receita de produtos</td><td>${fmt(cashClosingData.summary.revenueProducts)}</td></tr>
          <tr><td></td></tr>
          <tr><td><b>TOTAL GERAL</b></td><td><b>${fmt(cashClosingData.summary.totalRevenue)}</b></td></tr>
          <tr><td></td></tr>
          <tr><td colspan="4"><b>ATENDIMENTOS</b></td></tr>
          <tr><td><b>Horário</b></td><td><b>Cliente</b></td><td><b>Serviço</b></td><td><b>Valor</b></td></tr>
          ${cashClosingData.appointments.map((a) =>
            `<tr><td>${a.time}</td><td>${a.client}</td><td>${a.service}</td><td>${fmt(a.price)}</td></tr>`
          ).join("")}
          <tr><td></td></tr>
          <tr><td colspan="5"><b>PRODUTOS VENDIDOS</b></td></tr>
          <tr><td><b>Produto</b></td><td><b>Marca</b></td><td><b>Qtd</b></td><td><b>Valor Unit.</b></td><td><b>Total</b></td></tr>
          ${cashClosingData.products.map((p) =>
            `<tr><td>${p.name}</td><td>${p.brand}</td><td>${p.quantity}</td><td>${fmt(p.unitPrice)}</td><td>${fmt(p.total)}</td></tr>`
          ).join("")}
        </table>
      </body></html>`;

    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateFormatted = cashClosingDate.split("-").reverse().join("-");
    a.href = url;
    a.download = `fechamento-caixa-${dateFormatted}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async (showLoading = false) => {
      if (showLoading) setLoading(true);

      try {
        const response = await api.get<ApiEnvelope<DashboardData>>("/dashboard");
        cachedDashboardData = response.data.data;
        if (isMounted) setData(response.data.data);
      } catch (error) {
        if (isMounted) notify(getFriendlyError(error), "error");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const handleFocus = () => loadDashboard();

    loadDashboard(true);
    window.addEventListener("focus", handleFocus);
    const intervalId = window.setInterval(() => loadDashboard(), 60_000);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleFocus);
      window.clearInterval(intervalId);
    };
  }, [notify]);

  const maxWeeklyRevenue = useMemo(() => {
    return Math.max(...(data?.weeklyRevenue.map((point) => point.value) ?? [0]), 0);
  }, [data?.weeklyRevenue]);
  const flowTrendBuckets = data?.flowTrend?.buckets ?? [];
  const hasFlowTrendData = flowTrendBuckets.some((point) => point.count > 0);
  const isInitialLoading = loading && !data;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          eyebrow="Hoje"
          title="Visão geral do dia"
          description="Acompanhe o movimento da barbearia hoje"
        />
        <button
          onClick={openCashClosing}
          className="flex items-center gap-2 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold/20 lg:mb-1 self-start lg:self-auto"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Fechar Caixa
        </button>
        <button
          onClick={openHistory}
          className="flex items-center gap-2 rounded-2xl border border-border bg-panel px-4 py-2.5 text-sm font-semibold text-muted transition hover:text-text lg:mb-1 self-start lg:self-auto"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Histórico
        </button>
        <button
          onClick={openMonthly}
          className="flex items-center gap-2 rounded-2xl border border-border bg-panel px-4 py-2.5 text-sm font-semibold text-muted transition hover:text-text lg:mb-1 self-start lg:self-auto"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          Relatório Mensal
        </button>
      </div>

      {cashClosingOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-4 md:items-center md:justify-center">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[28px] border border-border bg-panel p-6 shadow-panel">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">Fechamento de Caixa</h2>
              <button onClick={() => setCashClosingOpen(false)} className="text-muted hover:text-text text-xl">✕</button>
            </div>

            <div className="flex items-center gap-3 mb-5">
              <input
                type="date"
                value={cashClosingDate}
                onChange={(e) => { setCashClosingDate(e.target.value); loadCashClosing(e.target.value); }}
                className="rounded-2xl border border-border bg-background px-4 py-2 text-sm outline-none focus:border-gold"
              />
              <span className="text-sm text-muted">Selecione a data</span>
            </div>

            {cashClosingLoading ? (
              <p className="text-sm text-muted py-8 text-center">Carregando...</p>
            ) : cashClosingData ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-4">
                  <div className="rounded-2xl border border-border bg-background p-3">
                    <p className="text-xs text-muted mb-1">Atendimentos</p>
                    <p className="text-xl font-bold">{cashClosingData.summary.totalAppointments}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-3">
                    <p className="text-xs text-muted mb-1">Receita cortes</p>
                    <p className="text-xl font-bold text-gold">R$ {cashClosingData.summary.revenueAppointments.toFixed(2)}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-3">
                    <p className="text-xs text-muted mb-1">Produtos</p>
                    <p className="text-xl font-bold">{cashClosingData.summary.totalProductsSold}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-3">
                    <p className="text-xs text-muted mb-1">Total geral</p>
                    <p className="text-xl font-bold text-gold">R$ {cashClosingData.summary.totalRevenue.toFixed(2)}</p>
                  </div>
                </div>

                {cashClosingData.appointments.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold/80 mb-2">Atendimentos</p>
                    <div className="space-y-2">
                      {cashClosingData.appointments.map((a, i) => (
                        <div key={i} className="flex justify-between text-sm border-b border-border pb-2">
                          <span className="text-muted w-12">{a.time}</span>
                          <span className="flex-1 px-3">{a.client}</span>
                          <span className="text-muted flex-1">{a.service}</span>
                          <span className="text-gold font-semibold">R$ {a.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {cashClosingData.products.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold/80 mb-2">Produtos vendidos</p>
                    <div className="space-y-2">
                      {cashClosingData.products.map((p, i) => (
                        <div key={i} className="flex justify-between text-sm border-b border-border pb-2">
                          <span className="flex-1">{p.name}</span>
                          <span className="text-muted px-3">{p.quantity}x</span>
                          <span className="text-gold font-semibold">R$ {p.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {cashClosingData.appointments.length === 0 && cashClosingData.products.length === 0 && (
                  <p className="text-sm text-muted text-center py-4">Nenhum movimento nesta data.</p>
                )}

                <button
                  onClick={exportToExcel}
                  disabled={cashClosingData.summary.totalRevenue === 0}
                  className="mt-2 w-full rounded-2xl bg-gold py-3 text-sm font-bold text-black transition hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Exportar Excel (.xlsx)
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-4 md:items-center md:justify-center">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[28px] border border-border bg-panel p-6 shadow-panel">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">Histórico de Fechamentos</h2>
              <button onClick={() => setHistoryOpen(false)} className="text-muted hover:text-text text-xl">✕</button>
            </div>
            {historyLoading ? (
              <p className="text-sm text-muted py-8 text-center">Carregando...</p>
            ) : !historyData || historyData.days.length === 0 ? (
              <p className="text-sm text-muted py-8 text-center">Nenhum movimento nos últimos 3 meses.</p>
            ) : (
              <div className="space-y-2">
                {historyData.days.map((day) => (
                  <div
                    key={day.date}
                    className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 cursor-pointer hover:border-gold/50 transition"
                    onClick={() => { setCashClosingDate(day.date); setHistoryOpen(false); openCashClosing(); }}
                  >
                    <div>
                      <p className="text-sm font-semibold">{day.dateFormatted}</p>
                      <p className="text-xs text-muted mt-0.5">{day.appointments} atendimento{day.appointments !== 1 ? "s" : ""} · {day.productsSold} produto{day.productsSold !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gold">R$ {day.total.toFixed(2)}</p>
                      <p className="text-xs text-muted">Ver detalhes →</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {monthlyOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-4 md:items-center md:justify-center">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[28px] border border-border bg-panel p-6 shadow-panel">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">Relatório Mensal</h2>
              <button onClick={() => setMonthlyOpen(false)} className="text-muted hover:text-text text-xl">✕</button>
            </div>
            <div className="flex items-center gap-2 mb-5">
              <select
                value={monthlyMonth}
                onChange={(e) => { const m = Number(e.target.value); setMonthlyMonth(m); loadMonthly(monthlyYear, m); }}
                className="rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
              >
                {["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
              <select
                value={monthlyYear}
                onChange={(e) => { const y = Number(e.target.value); setMonthlyYear(y); loadMonthly(y, monthlyMonth); }}
                className="rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold"
              >
                {[new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            {monthlyLoading ? (
              <p className="text-sm text-muted py-8 text-center">Carregando...</p>
            ) : monthlyData ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-background p-3">
                    <p className="text-xs text-muted mb-1">Dias trabalhados</p>
                    <p className="text-xl font-bold">{monthlyData.summary.workedDays}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-3">
                    <p className="text-xs text-muted mb-1">Clientes atendidos</p>
                    <p className="text-xl font-bold">{monthlyData.summary.totalClients}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-3">
                    <p className="text-xs text-muted mb-1">Ticket médio</p>
                    <p className="text-xl font-bold text-gold">R$ {monthlyData.summary.averageTicket.toFixed(2)}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-3">
                    <p className="text-xs text-muted mb-1">Receita cortes</p>
                    <p className="text-xl font-bold">R$ {monthlyData.summary.revenueAppointments.toFixed(2)}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-3">
                    <p className="text-xs text-muted mb-1">Receita produtos</p>
                    <p className="text-xl font-bold">R$ {monthlyData.summary.revenueProducts.toFixed(2)}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-3 col-span-2 sm:col-span-1">
                    <p className="text-xs text-muted mb-1">Total do mês</p>
                    <p className="text-xl font-bold text-gold">R$ {monthlyData.summary.totalRevenue.toFixed(2)}</p>
                  </div>
                </div>
                {(monthlyData.bestDay || monthlyData.worstDay) && (
                  <div className="flex gap-3 mb-5">
                    {monthlyData.bestDay && (
                      <div className="flex-1 rounded-2xl border border-border bg-background p-3">
                        <p className="text-xs text-muted mb-1">🏆 Melhor dia</p>
                        <p className="text-sm font-semibold">{monthlyData.bestDay.date}</p>
                        <p className="text-sm text-gold font-bold">R$ {monthlyData.bestDay.revenue.toFixed(2)}</p>
                      </div>
                    )}
                    {monthlyData.worstDay && (
                      <div className="flex-1 rounded-2xl border border-border bg-background p-3">
                        <p className="text-xs text-muted mb-1">📉 Pior dia</p>
                        <p className="text-sm font-semibold">{monthlyData.worstDay.date}</p>
                        <p className="text-sm text-muted font-bold">R$ {monthlyData.worstDay.revenue.toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                )}
                {monthlyData.topServices.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold/80 mb-3">Serviços mais realizados</p>
                    <div className="space-y-2">
                      {monthlyData.topServices.map((s, i) => (
                        <div key={i} className="flex justify-between text-sm border-b border-border pb-2">
                          <span>{s.label}</span>
                          <span className="text-gold font-semibold">{s.count}x</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {monthlyData.summary.totalRevenue === 0 && (
                  <p className="text-sm text-muted text-center py-4">Nenhum movimento neste mês.</p>
                )}
                <button
                  onClick={exportMonthlyToCSV}
                  disabled={monthlyData.summary.totalRevenue === 0}
                  className="mt-2 w-full rounded-2xl bg-gold py-3 text-sm font-bold text-black transition hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Exportar Relatório (.csv)
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {isInitialLoading ? (
        <div className="rounded-[32px] border border-border bg-panel p-6 text-sm text-muted">Carregando indicadores...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Faturamento de hoje" value={`R$ ${data?.revenueToday.toFixed(2) ?? "0,00"}`} hint="Atendimentos finalizados hoje" />
          <StatCard label="Clientes cadastrados" value={String(data?.totalClients ?? 0)} hint="Total de clientes no sistema" />
          <StatCard
            label="Produtos vendidos hoje"
            value={String(data?.productsSoldToday ?? 0).padStart(2, "0")}
            hint={(data?.productsSoldToday ?? 0) === 1 ? "1 unidade vendida hoje" : `${data?.productsSoldToday ?? 0} unidades vendidas hoje`}
          />
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.6fr_0.8fr]">
        <section className="rounded-[32px] border border-border bg-panel p-6">
          <div className="mb-8">
            <h2 className="text-xl font-bold">Faturamento semanal</h2>
            <p className="text-sm text-muted">Últimos 7 dias</p>
          </div>
          <div className="flex h-64 items-end gap-4">
            {isInitialLoading ? (
              <p className="text-sm text-muted">Carregando...</p>
            ) : data?.weeklyRevenue.every((point) => point.value === 0) ? (
              <p className="text-sm text-muted">Nenhum atendimento finalizado hoje.</p>
            ) : data?.weeklyRevenue.map((point) => {
              const height = maxWeeklyRevenue > 0 ? Math.round((point.value / maxWeeklyRevenue) * 100) : 0;

              return (
                <div key={point.day} className="flex flex-1 flex-col items-center gap-3">
                  <div
                    className="w-full rounded-t-[24px] bg-gradient-to-t from-gold/15 to-gold"
                    style={{ height: `${height}%` }}
                    title={`R$ ${point.value.toFixed(2)}`}
                  />
                  <span className="text-xs uppercase tracking-[0.2em] text-muted">{point.day}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-[32px] border border-border bg-panel p-6">
            <h2 className="text-xl font-bold">Produtos mais vendidos</h2>
            <div className="mt-6 space-y-5">
              {(data?.popularProducts.length ?? 0) === 0 ? (
                <p className="text-sm text-muted">Nenhuma venda registrada ainda.</p>
              ) : data?.popularProducts.map((product) => (
                <div key={product.label}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span>{product.label}</span>
                    <span className="text-gold">{product.count} {product.count === 1 ? "unid." : "unid."}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5">
                    <div className="h-2 rounded-full bg-gold" style={{ width: `${product.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-border bg-panel p-6">
            <h2 className="text-xl font-bold">Últimos atendimentos</h2>
            <div className="mt-5 space-y-4">
              {data?.recentActivities.length === 0 ? (
                <p className="text-sm text-muted">Nenhum atendimento finalizado ainda.</p>
              ) : data?.recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between rounded-2xl border border-border bg-background p-4">
                  <div>
                    <p className="font-semibold">{activity.clientName}</p>
                    <p className="text-sm text-muted">{activity.serviceLabel}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gold">R$ {activity.price.toFixed(2)}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">{activity.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="relative overflow-hidden rounded-[32px] border border-border bg-panel p-6 shadow-panel">
        <div className="absolute -right-4 -top-8 h-24 w-16 rotate-12 rounded-full bg-gold/10" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Tendência de fluxo</h2>
            <p className="mt-1 text-sm text-muted">Horários mais movimentados nos últimos 30 dias</p>
          </div>
          {data?.flowTrend?.peakLabel ? (
            <div className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
              Pico {data.flowTrend.peakLabel}
            </div>
          ) : null}
        </div>

        {isInitialLoading ? (
          <p className="mt-8 text-sm text-muted">Carregando...</p>
        ) : !hasFlowTrendData ? (
          <p className="mt-8 text-sm text-muted">Sem dados nos últimos 30 dias.</p>
        ) : (
          <div className="mt-7">
            <div className="relative flex h-36 items-end justify-between gap-3 border-b border-white/10 pb-6">
              <div className="absolute inset-x-0 top-1/3 border-t border-dashed border-white/10" />
              <div className="absolute inset-x-0 top-2/3 border-t border-dashed border-white/10" />
              {flowTrendBuckets.map((point) => (
                <div key={point.label} className="relative z-10 flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[10px] font-bold text-gold">
                    {point.count > 0 ? point.count : ""}
                  </span>
                  <div className="flex h-24 w-full items-end">
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
        )}
      </section>
    </div>
  );
}
