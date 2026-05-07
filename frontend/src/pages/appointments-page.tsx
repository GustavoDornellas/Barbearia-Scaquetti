import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { PageHeader } from "../components/ui/page-header";
import { StatusBadge } from "../components/ui/status-badge";
import { api, getFriendlyError } from "../services/api";
import { useToastStore } from "../store/toast-store";

type Appointment = {
  id: string;
  scheduledAt: string;
  endTime: string;
  serviceType: string;
  estimatedMinutes: number;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  client: { name: string };
  barber: { name: string };
};

const tomorrow = () => {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return date.toISOString().slice(0, 16);
};

export function AppointmentsPage() {
  const notify = useToastStore((state) => state.notify);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [barbers, setBarbers] = useState<Array<{ id: string; name: string }>>([]);
  const [serviceTypes, setServiceTypes] = useState<Array<{ type: string; estimatedMinutes: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    barberId: "",
    serviceType: "CORTE",
    scheduledAt: tomorrow()
  });

  async function load() {
    setLoading(true);
    try {
      const [appointmentsResponse, clientsResponse, barbersResponse, servicesResponse] = await Promise.all([
        api.get("/appointments"),
        api.get("/clients"),
        api.get("/users/barbers"),
        api.get("/appointments/service-types")
      ]);
      setAppointments(appointmentsResponse.data.data);
      setClients(clientsResponse.data.data.items);
      setBarbers(barbersResponse.data.data);
      setServiceTypes(servicesResponse.data.data);
    } catch (error) {
      notify(getFriendlyError(error), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    try {
      await api.post("/appointments", {
        ...form,
        scheduledAt: new Date(form.scheduledAt).toISOString()
      });
      notify("Agendamento criado.", "success");
      await load();
    } catch (error) {
      notify(getFriendlyError(error), "error");
    }
  }

  async function updateStatus(id: string, status: Appointment["status"]) {
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      notify("Agenda atualizada.", "success");
      await load();
    } catch (error) {
      notify(getFriendlyError(error), "error");
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-8">
        <PageHeader
          title="Agenda"
          description="Veja os horários marcados e evite conflito de barbeiro"
          actions={<Button onClick={handleCreate}>Salvar agendamento</Button>}
        />

        <section className="grid gap-4">
          {loading ? (
            <div className="rounded-[28px] border border-border bg-panel p-5 text-sm text-muted">Carregando agenda...</div>
          ) : appointments.length === 0 ? (
            <div className="rounded-[28px] border border-border bg-panel p-5 text-sm text-muted">Nenhum horário marcado.</div>
          ) : appointments.map((appointment) => (
            <div key={appointment.id} className="rounded-[28px] border border-border bg-panel p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold">{appointment.client.name}</h3>
                    <StatusBadge tone={appointment.status === "SCHEDULED" ? "gold" : appointment.status === "COMPLETED" ? "green" : "red"}>
                      {appointment.status === "SCHEDULED" ? "Agendado" : appointment.status === "COMPLETED" ? "Finalizado" : appointment.status === "NO_SHOW" ? "Não veio" : "Cancelado"}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-muted">{appointment.serviceType} com {appointment.barber.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                  <span>{new Date(appointment.scheduledAt).toLocaleString("pt-BR")} • {appointment.estimatedMinutes} min</span>
                  {appointment.status === "SCHEDULED" ? (
                    <>
                      <Button variant="secondary" onClick={() => updateStatus(appointment.id, "COMPLETED")}>Concluir</Button>
                      <Button variant="secondary" onClick={() => updateStatus(appointment.id, "NO_SHOW")}>Não veio</Button>
                      <Button variant="ghost" onClick={() => updateStatus(appointment.id, "CANCELLED")}>Cancelar</Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </section>
      </section>

      <aside className="rounded-[32px] border border-border bg-panel p-6">
        <h2 className="text-xl font-bold">Novo agendamento</h2>
        <p className="mt-2 text-sm text-muted">O sistema confere se o horário está livre.</p>

        <div className="mt-6 space-y-4">
          <select value={form.clientId} onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))} className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold">
            <option value="">Cliente</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
          <select value={form.barberId} onChange={(event) => setForm((current) => ({ ...current, barberId: event.target.value }))} className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold">
            <option value="">Barbeiro</option>
            {barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.name}</option>)}
          </select>
          <select value={form.serviceType} onChange={(event) => setForm((current) => ({ ...current, serviceType: event.target.value }))} className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold">
            {serviceTypes.map((service) => <option key={service.type} value={service.type}>{service.type} • {service.estimatedMinutes} min</option>)}
          </select>
          <input type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))} className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold" />
        </div>
      </aside>
    </div>
  );
}
