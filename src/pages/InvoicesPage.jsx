import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FilePlus2, Mail, Pencil, Printer, Search, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAppStore } from "../store/appStore.js";
import { formatMoney } from "../lib/invoice.js";
import { CustomSelect, PageHeader, StatusBadge } from "../components/ui.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Skeleton from "../components/Skeleton.jsx";
import api from "../lib/api.js";

export default function InvoicesPage() {
  const { invoices, loading, fetchInvoices, deleteInvoice, emailInvoice } = useAppStore();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState({ key: "createdAt", direction: "desc" });
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    fetchInvoices().catch((error) => toast.error(error.message));
  }, []);

  const filtered = useMemo(() => invoices.filter((invoice) => {
    const matchesQuery = [invoice.invoiceNumber, invoice.clientSnapshot?.name, invoice.clientSnapshot?.email].join(" ").toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === "All" || invoice.status === status;
    return matchesQuery && matchesStatus;
  }).sort((a, b) => compare(a, b, sort)), [invoices, query, status, sort]);
  const pageSize = 8;
  const pageCount = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, status]);

  const downloadPdf = async (invoice) => {
    try {
      const { data } = await api.get(`/invoices/${invoice._id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice.invoiceNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.response?.data?.message || "PDF download failed");
    }
  };

  const handlePrint = async (invoiceId) => {
    try {
      const token = localStorage.getItem("invoiceflow_token") || localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error("Print PDF failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 2000);
      };
    } catch (error) {
      toast.error(error.message || "Print failed");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Invoice operations"
        title="Invoice History"
        description="Search, filter, download, print, email, edit, and delete real invoices from the database."
        action={<Link className="premium-btn" to="/invoices/new"><FilePlus2 className="h-4 w-4" /> New invoice</Link>}
      />
      <div className="premium-card">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 dark:border-slate-800 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input className="premium-input pl-12" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by invoice, client, status..." />
          </div>
          <div className="md:w-52"><CustomSelect value={status} onChange={setStatus} options={["All", "Draft", "Sent", "Paid", "Pending", "Overdue", "Cancelled"]} /></div>
        </div>
        {loading.invoices ? <div className="pt-5"><Skeleton /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr><Sortable label="Invoice" sortKey="invoiceNumber" sort={sort} setSort={setSort} /><th>Client</th><Sortable label="Due date" sortKey="dueDate" sort={sort} setSort={setSort} /><Sortable label="Status" sortKey="status" sort={sort} setSort={setSort} /><Sortable label="Total" sortKey="total" sort={sort} setSort={setSort} /><th>Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((invoice) => (
                  <tr key={invoice._id}>
                    <td className="py-4 font-bold">{invoice.invoiceNumber}</td>
                    <td><p className="font-semibold">{invoice.clientSnapshot?.name}</p><p className="text-xs text-slate-500">{invoice.clientSnapshot?.email}</p></td>
                    <td className="text-slate-500">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "On receipt"}</td>
                    <td><StatusBadge status={invoice.status} /></td>
                    <td className="font-bold">{formatMoney(invoice.total, invoice.currency)}</td>
                    <td>
                      <div className="flex gap-2">
                        <Link className="secondary-btn px-3 py-2" to={`/invoices/${invoice._id}/edit`}><Pencil className="h-4 w-4" /></Link>
                        <button className="secondary-btn px-3 py-2" onClick={() => downloadPdf(invoice)}><Download className="h-4 w-4" /></button>
                        <button className="secondary-btn px-3 py-2" onClick={() => handlePrint(invoice._id)}><Printer className="h-4 w-4" /></button>
                        <button className="secondary-btn px-3 py-2" onClick={async () => { try { await emailInvoice(invoice._id, invoice.clientSnapshot?.email); toast.success("Invoice emailed"); } catch (error) { toast.error(error.message); } }}><Mail className="h-4 w-4" /></button>
                        <button className="secondary-btn px-3 py-2 text-rose-500" onClick={() => setDeleting(invoice)}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan="6" className="py-12 text-center text-slate-500">No invoices found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageCount={pageCount} total={filtered.length} onPage={setPage} />
      </div>

      <ConfirmDialog open={Boolean(deleting)} title="Delete invoice" description={`Delete ${deleting?.invoiceNumber}? Analytics and history will update immediately.`} busy={loading.invoices} onCancel={() => setDeleting(null)} onConfirm={async () => {
        try {
          await deleteInvoice(deleting._id);
          toast.success("Invoice deleted");
          setDeleting(null);
        } catch (error) {
          toast.error(error.message);
        }
      }} />
    </>
  );
}

function Sortable({ label, sortKey, sort, setSort }) {
  const active = sort.key === sortKey;
  return <th className="py-4"><button className="font-bold uppercase tracking-wide" onClick={() => setSort((current) => ({ key: sortKey, direction: current.key === sortKey && current.direction === "asc" ? "desc" : "asc" }))}>{label} {active ? (sort.direction === "asc" ? "↑" : "↓") : ""}</button></th>;
}

function Pagination({ page, pageCount, total, onPage }) {
  return <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 text-sm text-slate-500 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"><span>{total} invoices • Page {page} of {pageCount}</span><div className="flex gap-2"><button className="secondary-btn px-3 py-2" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><button className="secondary-btn px-3 py-2" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>Next</button></div></div>;
}

function compare(a, b, sort) {
  const get = (item) => sort.key === "dueDate" ? new Date(item.dueDate || 0).getTime() : item[sort.key];
  const av = get(a);
  const bv = get(b);
  const result = typeof av === "number" || typeof bv === "number" ? Number(av || 0) - Number(bv || 0) : String(av || "").localeCompare(String(bv || ""));
  return sort.direction === "asc" ? result : -result;
}
