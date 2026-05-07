import { FormEvent, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { PageHeader } from "../components/ui/page-header";
import { StatCard } from "../components/ui/stat-card";
import { StatusBadge } from "../components/ui/status-badge";
import { api, getFriendlyError } from "../services/api";
import { useToastStore } from "../store/toast-store";

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  status: "NORMAL" | "LOW" | "CRITICAL";
  sku: string;
  costPrice: number;
  salePrice: number;
  lowStockAlert: number;
  criticalAlert: number;
};

const emptyItem = {
  name: "",
  sku: "",
  category: "",
  quantity: "",
  unit: "unid.",
  costPrice: 0,
  salePrice: "",
  lowStockAlert: 10,
  criticalAlert: 3
};

function makeSku(name: string, brand: string) {
  const base = `${brand}-${name}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase()
    .slice(0, 28);

  return base || `PRODUTO-${Date.now()}`;
}

export function InventoryPage() {
  const notify = useToastStore((state) => state.notify);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState({ totalItems: 0, lowStock: 0, marketValue: 0 });
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(emptyItem);
  const [movement, setMovement] = useState<{ item: InventoryItem; type: "IN" | "OUT" | "ADJUSTMENT"; quantity: number; reason: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await api.get("/inventory");
      setItems(response.data.data.items);
      setSummary(response.data.data.summary);
    } catch (error) {
      notify(getFriendlyError(error), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openForm(item?: InventoryItem) {
    setEditing(item ?? null);
    setFormOpen(true);
    setForm(item ? {
      name: item.name,
      sku: item.sku,
      category: item.category,
      quantity: String(item.quantity),
      unit: item.unit,
      costPrice: Number(item.costPrice),
      salePrice: String(item.salePrice),
      lowStockAlert: item.lowStockAlert,
      criticalAlert: item.criticalAlert
    } : emptyItem);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.category.trim()) {
      notify("Informe nome e marca do produto.", "error");
      return;
    }
    const quantity = Number(form.quantity);
    const salePrice = Number(form.salePrice);

    if (Number.isNaN(quantity) || Number.isNaN(salePrice) || quantity < 0 || salePrice < 0) {
      notify("Quantidade e valor nao podem ser negativos.", "error");
      return;
    }

    const payload = {
      ...form,
      quantity,
      salePrice,
      sku: editing ? form.sku : makeSku(form.name, form.category),
      unit: "unid.",
      costPrice: salePrice,
      lowStockAlert: 10,
      criticalAlert: 3
    };

    try {
      if (editing) {
        await api.patch(`/inventory/${editing.id}`, payload);
        notify("Produto atualizado.", "success");
      } else {
        await api.post("/inventory", payload);
        notify("Produto cadastrado.", "success");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      notify(getFriendlyError(error), "error");
    }
  }

  async function remove(item: InventoryItem) {
    try {
      await api.delete(`/inventory/${item.id}`);
      notify("Produto excluido.", "success");
      setPendingDelete(null);
      await load();
    } catch (error) {
      notify(getFriendlyError(error), "error");
    }
  }

  async function submitMovement(event: FormEvent) {
    event.preventDefault();
    if (!movement) return;
    if (movement.quantity <= 0) {
      notify("Informe uma quantidade maior que zero.", "error");
      return;
    }

    try {
      await api.post(`/inventory/${movement.item.id}/movements`, {
        type: movement.type,
        quantity: movement.quantity,
        reason: movement.reason
      });
      notify("Movimentação salva.", "success");
      setMovement(null);
      await load();
    } catch (error) {
      notify(getFriendlyError(error), "error");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Estoque"
        description="Controle de produtos da barbearia"
        actions={<Button onClick={() => openForm()}>Novo produto</Button>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Produtos cadastrados" value={String(summary.totalItems)} hint="Itens no estoque" />
        <StatCard label="Produtos acabando" value={String(summary.lowStock).padStart(2, "0")} hint="Precisa repor" />
        <StatCard label="Valor total em estoque" value={`R$ ${summary.marketValue.toFixed(2)}`} hint="Pelo preço de venda" />
      </div>

      <section className="overflow-hidden rounded-[32px] border border-border bg-panel">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.4fr] gap-3 border-b border-border px-6 py-4 text-xs uppercase tracking-[0.2em] text-muted">
          <span>Produto</span>
          <span>Marca</span>
          <span>Quantidade</span>
          <span>Status</span>
          <span>Ações</span>
        </div>
        {loading ? (
          <div className="px-6 py-10 text-sm text-muted">Carregando estoque...</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-10 text-sm text-muted">Nenhum produto cadastrado.</div>
        ) : items.map((item) => (
          <div key={item.id} className="grid grid-cols-1 gap-3 border-b border-border px-6 py-5 text-sm lg:grid-cols-[2fr_1fr_1fr_1fr_1.4fr]">
            <div>
              <div className="font-semibold">{item.name}</div>
            <div className="text-xs text-muted">{item.category}</div>
            </div>
            <div className="text-muted">R$ {Number(item.salePrice).toFixed(2)}</div>
            <div className="font-semibold">{item.quantity} <span className="text-xs text-muted">{item.unit}</span></div>
            <div>
              <StatusBadge tone={item.status === "NORMAL" ? "green" : item.status === "LOW" ? "gold" : "red"}>
                {item.status === "NORMAL" ? "Em estoque" : item.status === "LOW" ? "Acabando" : "Crítico"}
              </StatusBadge>
            </div>
            <div className="flex flex-nowrap items-center gap-2">
              <Button variant="secondary" onClick={() => setMovement({ item, type: "IN", quantity: 1, reason: "" })}>Movimentar</Button>
              <Button variant="secondary" onClick={() => openForm(item)}>Editar</Button>
              <button
                type="button"
                aria-label={`Excluir ${item.name}`}
                title="Excluir produto"
                onClick={() => setPendingDelete(item)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-panelSoft text-muted transition hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-200"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </section>

      {formOpen && (
        <form onSubmit={submit} className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-3xl rounded-[28px] border border-border bg-panel p-5 shadow-panel">
          <h2 className="text-lg font-bold">{editing ? "Editar produto" : "Novo produto"}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Nome do produto"
              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold"
            />
            <input
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              placeholder="Marca"
              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.salePrice}
              onChange={(event) => setForm({ ...form, salePrice: event.target.value })}
              placeholder="Valor"
              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold"
            />
            <input
              type="number"
              min="0"
              value={form.quantity}
              onChange={(event) => setForm({ ...form, quantity: event.target.value })}
              placeholder="Quantidade"
              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold"
            />
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      )}

      {movement && (
        <form onSubmit={submitMovement} className="fixed inset-0 z-50 flex items-end bg-black/60 p-4 md:items-center md:justify-center">
          <div className="w-full max-w-md rounded-[28px] border border-border bg-panel p-6 shadow-panel">
            <h2 className="text-lg font-bold">Movimentar estoque</h2>
            <p className="mt-1 text-sm text-muted">{movement.item.name}</p>
            <select value={movement.type} onChange={(event) => setMovement({ ...movement, type: event.target.value as typeof movement.type })} className="mt-4 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold">
              <option value="IN">Entrada</option>
              <option value="OUT">Saida</option>
              <option value="ADJUSTMENT">Ajuste absoluto</option>
            </select>
            <input type="number" min="0" value={movement.quantity} onChange={(event) => setMovement({ ...movement, quantity: Number(event.target.value) })} className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold" />
            <input value={movement.reason} onChange={(event) => setMovement({ ...movement, reason: event.target.value })} placeholder="Motivo" className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold" />
            <div className="mt-5 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setMovement(null)}>Cancelar</Button>
              <Button type="submit">Registrar</Button>
            </div>
          </div>
        </form>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-4 md:items-center md:justify-center">
          <div className="w-full max-w-md rounded-[28px] border border-border bg-panel p-6 shadow-panel">
            <h2 className="text-lg font-bold">Arquivar produto?</h2>
            <p className="mt-2 text-sm text-muted">
              {pendingDelete.name} sai da lista, mas o histórico fica salvo.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setPendingDelete(null)}>Cancelar</Button>
              <Button
                type="button"
                className="bg-red-500 text-white hover:bg-red-400"
                onClick={() => remove(pendingDelete)}
              >
                Excluir produto
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
