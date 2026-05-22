import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { PageHeader } from "../components/ui/page-header";
import { api, getFriendlyError } from "../services/api";
import { useToastStore } from "../store/toast-store";

export function ClientFormPage() {
  const navigate = useNavigate();
  const notify = useToastStore((state) => state.notify);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    whatsappOptIn: true
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await api.post("/clients", form);
      notify("Cliente cadastrado.", "success");
      navigate("/clientes");
    } catch (error) {
      notify(getFriendlyError(error), "error");
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[1.3fr_0.7fr]">
      <section className="min-w-0 space-y-8">
        <PageHeader
          title={
            <>
              Novo <span className="text-gold">cliente</span>
            </>
          }
          description="Cadastre quem acabou de chegar na barbearia"
        />

        <form onSubmit={handleSubmit} className="space-y-4 rounded-[32px] border border-border bg-panel p-6">
          {[
            { label: "Nome", key: "name" },
            { label: "E-mail", key: "email" },
            { label: "Telefone", key: "phone" }
          ].map((field) => (
            <label key={field.key} className="block">
              <span className="mb-2 block text-sm text-muted">{field.label}</span>
              <input
                value={form[field.key as keyof typeof form] as string}
                onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold"
              />
            </label>
          ))}

          <label className="block">
            <span className="mb-2 block text-sm text-muted">Observações</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className="min-h-32 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold"
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-4">
            <input
              checked={form.whatsappOptIn}
              onChange={(event) => setForm((current) => ({ ...current, whatsappOptIn: event.target.checked }))}
              type="checkbox"
            />
            <span className="text-sm">Pode receber mensagem pelo WhatsApp</span>
          </label>

          <div className="flex gap-3">
            <Button type="submit">Salvar cliente</Button>
            <Button type="button" variant="secondary" onClick={() => navigate("/clientes")}>
              Cancelar
            </Button>
          </div>
        </form>
      </section>

      <aside className="space-y-5">
        <div className="rounded-[32px] border border-border bg-panel p-6">
          <p className="text-lg font-semibold text-gold">Dica do balcão</p>
          <p className="mt-3 text-sm leading-7 text-muted">
            Anote preferências de corte. Na próxima visita, o atendimento já começa melhor.
          </p>
        </div>
        <div className="overflow-hidden rounded-[32px] border border-border bg-panel">
          <div className="h-64 bg-[radial-gradient(circle_at_top,_rgba(216,177,93,0.2),_transparent_30%),linear-gradient(135deg,_#201c18,_#090909)]" />
        </div>
      </aside>
    </div>
  );
}
