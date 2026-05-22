import { FormEvent, useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { PageHeader } from "../components/ui/page-header";
import { StatCard } from "../components/ui/stat-card";
import { api, getFriendlyError } from "../services/api";
import { useToastStore } from "../store/toast-store";

type Client = {
  id: string;
  name: string;
  email?: string | null;
  phone: string;
  notes?: string | null;
  whatsappOptIn: boolean;
  totalSpent: number;
  lastVisitAt?: string;
};

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  notes: "",
  whatsappOptIn: true
};

function getPhoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function formatBrazilianMobilePhone(value: string) {
  const digits = getPhoneDigits(value);
  if (digits.length <= 2) return digits;

  const areaCode = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length <= 5) return `(${areaCode}) ${number}`;

  return `(${areaCode}) ${number.slice(0, 5)}-${number.slice(5)}`;
}

function isValidBrazilianMobilePhone(value: string) {
  return /^[1-9]{2}9\d{8}$/.test(getPhoneDigits(value));
}

export function ClientsPage() {
  const notify = useToastStore((state) => state.notify);
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ totalClients: 0, attendedThisMonth: 0, revenueFromClients: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function load(nextPage = page, nextSearch = search) {
    setLoading(true);
    try {
      const response = await api.get("/clients", { params: { page: nextPage, search: nextSearch } });
      setClients(response.data.data.items);
      setTotal(response.data.data.total);
      setSummary(response.data.data.summary);
      setPage(response.data.data.page);
    } catch (error) {
      notify(getFriendlyError(error), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, "");
  }, []);

  function startEdit(client?: Client) {
    setEditing(client ?? null);
    setFormOpen(true);
    setForm(
      client
        ? {
            name: client.name,
            email: "",
            phone: formatBrazilianMobilePhone(client.phone),
            notes: client.notes ?? "",
            whatsappOptIn: true
          }
        : emptyForm
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      notify("Informe o nome do cliente.", "error");
      return;
    }
    if (!isValidBrazilianMobilePhone(form.phone)) {
      notify("Informe um celular com DDD, 9 e mais 8 numeros.", "error");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      phone: getPhoneDigits(form.phone),
      notes: form.notes,
      email: "",
      whatsappOptIn: true
    };
    try {
      if (editing) {
        await api.patch(`/clients/${editing.id}`, payload);
        notify("Cliente atualizado com sucesso.", "success");
      } else {
        await api.post("/clients", payload);
        notify("Cliente cadastrado com sucesso.", "success");
      }
      setEditing(null);
      setFormOpen(false);
      setForm(emptyForm);
      await load();
    } catch (error) {
      notify(getFriendlyError(error), "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(client: Client) {
    try {
      await api.delete(`/clients/${client.id}`);
      notify("Cliente excluido com sucesso.", "success");
      setPendingDelete(null);
      await load();
    } catch (error) {
      notify(getFriendlyError(error), "error");
    }
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    await load(1, search);
  }

  const pageCount = Math.max(1, Math.ceil(total / 5));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Clientes"
        description="Veja seus clientes e histórico de atendimentos"
        actions={<Button onClick={() => startEdit()}>Adicionar cliente</Button>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Clientes cadastrados" value={String(summary.totalClients)} hint="Total de clientes no sistema" />
        <StatCard label="Atendidos este mês" value={String(summary.attendedThisMonth)} hint="Clientes que voltaram este mês" />
        <StatCard label="Total gasto pelos clientes" value={`R$ ${summary.revenueFromClients.toFixed(2)}`} hint="Soma dos atendimentos" />
      </div>

      <form onSubmit={handleSearch} className="flex flex-col gap-3 rounded-[28px] border border-border bg-panel p-4 md:flex-row">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome ou telefone"
          className="min-h-12 flex-1 rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-gold"
        />
        <Button type="submit" disabled={loading}>Buscar</Button>
      </form>

      <section className="overflow-hidden rounded-[32px] border border-border bg-panel">
        <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 border-b border-border px-6 py-4 text-xs uppercase tracking-[0.2em] text-muted">
          <span>Cliente</span>
          <span>Telefone</span>
          <span>Última visita</span>
          <span>Ações</span>
        </div>
        {loading ? (
          <div className="px-6 py-10 text-sm text-muted">Carregando clientes...</div>
        ) : clients.length === 0 ? (
          <div className="px-6 py-10 text-sm text-muted">Nenhum cliente encontrado.</div>
        ) : (
          clients.map((client) => (
            <div key={client.id} className="grid grid-cols-1 gap-3 border-b border-border px-6 py-5 text-sm lg:grid-cols-[2fr_1fr_1fr_1fr]">
              <div>
                <div className="font-semibold">{client.name}</div>
                <div className="mt-1 text-xs text-muted">Cliente cadastrado</div>
              </div>
              <div className="text-muted">{formatBrazilianMobilePhone(client.phone)}</div>
              <div className="text-muted">{client.lastVisitAt ? new Date(client.lastVisitAt).toLocaleDateString("pt-BR") : "Sem visitas"}</div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => startEdit(client)}>Editar</Button>
                <Button variant="ghost" onClick={() => setPendingDelete(client)}>Excluir</Button>
              </div>
            </div>
          ))
        )}
      </section>

      <div className="flex items-center justify-end gap-3">
        <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>Anterior</Button>
        <span className="text-sm text-muted">{page} / {pageCount}</span>
        <Button variant="secondary" disabled={page >= pageCount || loading} onClick={() => load(page + 1)}>Proxima</Button>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60 p-4 md:items-center md:justify-center">
        <form onSubmit={submit} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[32px] border border-border bg-panel p-6 shadow-panel">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-gold">Cliente</p>
            <h2 className="mt-2 text-2xl font-bold">{editing ? "Editar cliente" : "Novo cliente"}</h2>
            <p className="mt-1 text-sm text-muted">Anote o que ajuda no próximo atendimento.</p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nome" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold" />
            <input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: formatBrazilianMobilePhone(event.target.value) })}
              inputMode="numeric"
              autoComplete="tel"
              maxLength={15}
              placeholder="(11) 99999-9999"
              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold"
            />
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Observações: preferência de corte, alergias ou algum detalhe importante..."
              className="min-h-36 resize-none rounded-3xl border border-border bg-background px-4 py-4 text-sm leading-6 outline-none transition focus:border-gold md:col-span-2"
            />
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setEditing(null); setForm(emptyForm); setFormOpen(false); }}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-4 md:items-center md:justify-center">
          <div className="w-full max-w-md rounded-[28px] border border-border bg-panel p-6 shadow-panel">
            <h2 className="text-lg font-bold">Excluir cliente?</h2>
            <p className="mt-2 text-sm text-muted">{pendingDelete.name} vai sair da lista de clientes.</p>
            <div className="mt-5 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setPendingDelete(null)}>Cancelar</Button>
              <Button type="button" onClick={() => remove(pendingDelete)}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
