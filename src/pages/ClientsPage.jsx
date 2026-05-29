import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Building2, Eye, Mail, Pencil, Phone, Plus, Search, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAppStore } from "../store/appStore.js";
import { CustomSelect, PageHeader, StatusBadge } from "../components/ui.jsx";
import CrudModal from "../components/CrudModal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Skeleton from "../components/Skeleton.jsx";
import api from "../lib/api.js";
import { formatMoney } from "../lib/invoice.js";

const clientSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  company: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  GSTIN: z.string().optional(),
  panNumber: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
  currency: z.string().min(2),
  status: z.enum(["Active", "Inactive"])
});

export default function ClientsPage() {
  const { clients, loading, fetchClients, saveClient, deleteClient } = useAppStore();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [history, setHistory] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchClients().catch((error) => toast.error(error.message));
  }, []);

  const filtered = useMemo(() => clients.filter((client) => [client.name, client.company, client.email, client.status].join(" ").toLowerCase().includes(query.toLowerCase())), [clients, query]);

  return (
    <>
      <PageHeader
        eyebrow="Customer operations"
        title="Client Management"
        description="Maintain client billing profiles, tax IDs, currencies, contacts, and revenue visibility in one clean workspace."
        action={<button className="premium-btn" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add client</button>}
      />
      <div className="premium-card">
        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input className="premium-input pl-12" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clients by name, company, email, status..." />
        </div>
        {loading.clients ? <Skeleton /> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {filtered.map((client) => (
              <div key={client._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-soft dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-lg font-black text-white">{(client.company || client.name)?.[0]}</div>
                  <StatusBadge status={client.status} />
                </div>
                <h3 className="mt-5 text-lg font-black">{client.company || client.name}</h3>
                <p className="text-sm font-medium text-slate-500">{client.name}</p>
                <div className="mt-5 space-y-2 text-sm text-slate-500">
                  <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {client.email}</p>
                  <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {client.phone || "No phone"}</p>
                  <p className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Currency: {client.currency}</p>
                </div>
                <div className="mt-5 flex gap-2">
                  <button className="secondary-btn px-3 py-2" onClick={async () => {
                    try {
                      const { data } = await api.get(`/clients/${client._id}/invoices`);
                      setHistory({ client, invoices: data });
                    } catch (error) {
                      toast.error(error.response?.data?.message || "Could not load invoice history");
                    }
                  }}><Eye className="h-4 w-4" /></button>
                  <button className="secondary-btn flex-1 px-3 py-2" onClick={() => { setEditing(client); setOpen(true); }}><Pencil className="h-4 w-4" /> Edit</button>
                  <button className="secondary-btn px-3 py-2 text-rose-500" onClick={() => setDeleting(client)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
            {!filtered.length && <p className="col-span-full py-12 text-center text-slate-500">No clients found.</p>}
          </div>
        )}
      </div>

      <ClientForm open={open} client={editing} onClose={() => setOpen(false)} onSave={async (values) => {
        try {
          await saveClient(values, editing?._id);
          toast.success(editing ? "Client updated" : "Client created");
          setOpen(false);
        } catch (error) {
          toast.error(error.message);
        }
      }} />

      <ConfirmDialog open={Boolean(deleting)} title="Delete client" description={`Delete ${deleting?.company || deleting?.name}? This cannot be undone.`} busy={loading.clients} onCancel={() => setDeleting(null)} onConfirm={async () => {
        try {
          await deleteClient(deleting._id);
          toast.success("Client deleted");
          setDeleting(null);
        } catch (error) {
          toast.error(error.message);
        }
      }} />
      <CrudModal open={Boolean(history)} title={`${history?.client?.company || history?.client?.name || "Client"} invoice history`} onClose={() => setHistory(null)}>
        <div className="max-h-[60vh] overflow-auto">
          <table className="premium-table min-w-[620px]">
            <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th>Invoice</th><th>Status</th><th>Issue date</th><th>Total</th></tr></thead>
            <tbody>
              {(history?.invoices || []).map((invoice) => (
                <tr key={invoice._id}>
                  <td className="font-bold">{invoice.invoiceNumber}</td>
                  <td><StatusBadge status={invoice.status} /></td>
                  <td className="text-slate-500">{invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : ""}</td>
                  <td className="font-bold">{formatMoney(invoice.total, invoice.currency)}</td>
                </tr>
              ))}
              {history && !history.invoices.length && <tr><td colSpan="4" className="py-10 text-center text-slate-500">No invoices for this client yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </CrudModal>
    </>
  );
}

function ClientForm({ open, client, onClose, onSave }) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(clientSchema),
    defaultValues: client || { currency: "INR", status: "Active" }
  });

  useEffect(() => {
    reset(client || { name: "", email: "", company: "", phone: "", address: "", taxId: "", GSTIN: "", panNumber: "", website: "", notes: "", currency: "INR", status: "Active" });
  }, [client, reset, open]);

  return (
    <CrudModal open={open} title={client ? "Edit client" : "Create client"} onClose={onClose}>
      <form onSubmit={handleSubmit(onSave)} className="grid gap-4 md:grid-cols-2">
        <Field label="Client name" error={errors.name?.message}><input className="premium-input" {...register("name")} /></Field>
        <Field label="Email" error={errors.email?.message}><input className="premium-input" {...register("email")} /></Field>
        <Field label="Company"><input className="premium-input" {...register("company")} /></Field>
        <Field label="Phone"><input className="premium-input" {...register("phone")} /></Field>
        <Field label="GSTIN"><input className="premium-input" {...register("GSTIN")} /></Field>
        <CustomSelect label="Currency" value={watch("currency")} onChange={(value) => setValue("currency", value, { shouldValidate: true })} options={["INR", "USD", "EUR", "GBP", "AED"]} />
        <CustomSelect label="Status" value={watch("status")} onChange={(value) => setValue("status", value, { shouldValidate: true })} options={["Active", "Inactive"]} />
        <label className="block md:col-span-2"><span className="premium-label">Address</span><textarea className="premium-input mt-2 min-h-24" {...register("address")} /></label>
        <div className="flex justify-end gap-3 md:col-span-2"><button type="button" className="secondary-btn" onClick={onClose}>Cancel</button><button className="premium-btn" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save client"}</button></div>
      </form>
    </CrudModal>
  );
}

function Field({ label, error, children }) {
  return <label className="block"><span className="premium-label">{label}</span><div className="mt-2">{children}</div>{error && <span className="mt-1 block text-xs font-semibold text-rose-500">{error}</span>}</label>;
}
