import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/ui/page-header";
import { StatCard } from "../components/ui/stat-card";
import { api, ApiEnvelope, getFriendlyError } from "../services/api";
import { useToastStore } from "../store/toast-store";

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
      <PageHeader
        eyebrow="Hoje"
        title="Visão geral do dia"
        description="Acompanhe o movimento da barbearia hoje"
      />

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
