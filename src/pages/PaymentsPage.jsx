import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CreditCard, Download, Landmark, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useAppStore } from "../store/appStore.js";
import { formatMoney } from "../lib/invoice.js";
import { CustomSelect, PageHeader, StatusBadge } from "../components/ui.jsx";
import CrudModal from "../components/CrudModal.jsx";
import Skeleton from "../components/Skeleton.jsx";

const schema = z.object({
  invoice: z.string().min(1, "Invoice is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().min(2),
  method: z.enum(["Card", "Bank Transfer", "UPI", "Cash", "Other"]),
  status: z.enum(["Succeeded", "Pending", "Failed"]),
  transactionId: z.string().optional()
});

export default function PaymentsPage() {
  const { payments, invoices, loading, fetchPayments, fetchInvoices, savePayment } = useAppStore();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    Promise.all([fetchPayments(), fetchInvoices()]).catch((error) => toast.error(error.message));
  }, []);

  const summary = useMemo(() => payments.reduce((acc, payment) => {
    acc.total += Number(payment.amount || 0);
    acc[payment.method] = (acc[payment.method] || 0) + Number(payment.amount || 0);
    return acc;
  }, { total: 0 }), [payments]);
  const pageSize = 8;
  const pageCount = Math.max(Math.ceil(payments.length / pageSize), 1);
  const rows = payments.slice((page - 1) * pageSize, page * pageSize);

  const exportLedger = () => {
    const csv = ["Invoice,Client,Method,Status,Amount,Currency,Transaction ID"].concat(payments.map((payment) => [
      payment.invoice?.invoiceNumber || "",
      payment.invoice?.clientSnapshot?.name || "",
      payment.method,
      payment.status,
      payment.amount,
      payment.currency,
      payment.transactionId || ""
    ].map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "payment-ledger.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        eyebrow="Cash collection"
        title="Payment Tracking"
        description="Track partial payments, payment methods, transaction IDs, and collection status against invoices."
        action={<button className="premium-btn" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Record payment</button>}
      />
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="premium-card">
          <CreditCard className="h-8 w-8 text-blue-600" />
          <h2 className="mt-4 text-xl font-black">Payment summary</h2>
          <div className="mt-6 space-y-3">
            {["Card", "Bank Transfer", "UPI", "Cash", "Other"].map((method) => <div key={method} className="rounded-2xl bg-slate-50 p-4 text-sm font-bold dark:bg-slate-800">{method}: {formatMoney(summary[method] || 0)}</div>)}
          </div>
          <button className="secondary-btn mt-5 w-full" onClick={exportLedger}><Download className="h-4 w-4" /> Export ledger</button>
        </div>
        <div className="premium-card overflow-hidden p-0">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800"><h2 className="text-lg font-bold">Recent transactions</h2></div>
          {loading.payments ? <div className="p-5"><Skeleton /></div> : (
            <div className="overflow-x-auto">
              <table className="premium-table min-w-[720px]">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800"><tr><th className="px-5 py-4">Invoice</th><th>Client</th><th>Method</th><th>Status</th><th>Amount</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((payment) => (
                    <tr key={payment._id}>
                      <td className="px-5 py-4 font-bold">{payment.invoice?.invoiceNumber}</td>
                      <td>{payment.invoice?.clientSnapshot?.name || "Client"}</td>
                      <td><span className="inline-flex items-center gap-2 text-slate-500"><Landmark className="h-4 w-4" /> {payment.method}</span></td>
                      <td><StatusBadge status={payment.status === "Succeeded" ? "Paid" : "Pending"} /></td>
                      <td className="font-bold">{formatMoney(payment.amount, payment.currency)}</td>
                    </tr>
                  ))}
                  {!payments.length && <tr><td colSpan="5" className="px-5 py-10 text-center text-slate-500">No payments recorded.</td></tr>}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm text-slate-500 dark:border-slate-800">
                <span>{payments.length} payments • Page {page} of {pageCount}</span>
                <div className="flex gap-2"><button className="secondary-btn px-3 py-2" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="secondary-btn px-3 py-2" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</button></div>
              </div>
            </div>
          )}
        </div>
      </div>
      <PaymentForm open={open} invoices={invoices} onClose={() => setOpen(false)} onSave={async (values) => {
        try {
          await savePayment(values);
          toast.success("Payment recorded");
          setOpen(false);
        } catch (error) {
          toast.error(error.message);
        }
      }} />
    </>
  );
}

function PaymentForm({ open, invoices, onClose, onSave }) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), defaultValues: { currency: "INR", method: "UPI", status: "Succeeded" } });
  useEffect(() => {
    reset({ invoice: invoices[0]?._id || "", amount: "", currency: invoices[0]?.currency || "INR", method: "UPI", status: "Succeeded", transactionId: "" });
  }, [open, invoices, reset]);
  return (
    <CrudModal open={open} title="Record payment" onClose={onClose}>
      <form onSubmit={handleSubmit(onSave)} className="grid gap-4 md:grid-cols-2">
        <CustomSelect label="Invoice" value={watch("invoice")} onChange={(value) => setValue("invoice", value, { shouldValidate: true })} options={invoices.map((invoice) => ({ label: `${invoice.invoiceNumber} - ${invoice.clientSnapshot?.name || "Client"}`, value: invoice._id }))} error={errors.invoice?.message} />
        <Field label="Amount" error={errors.amount?.message}><input className="premium-input" type="number" step="0.01" {...register("amount")} /></Field>
        <CustomSelect label="Currency" value={watch("currency")} onChange={(value) => setValue("currency", value, { shouldValidate: true })} options={["INR", "USD", "EUR", "GBP", "AED"]} />
        <CustomSelect label="Method" value={watch("method")} onChange={(value) => setValue("method", value, { shouldValidate: true })} options={["Cash", "Bank Transfer", "UPI", "Card", "Other"]} />
        <CustomSelect label="Status" value={watch("status")} onChange={(value) => setValue("status", value, { shouldValidate: true })} options={["Succeeded", "Pending", "Failed"]} />
        <Field label="Transaction ID"><input className="premium-input" {...register("transactionId")} /></Field>
        <div className="flex justify-end gap-3 md:col-span-2"><button type="button" className="secondary-btn" onClick={onClose}>Cancel</button><button className="premium-btn" disabled={isSubmitting || !invoices.length}>{isSubmitting ? "Saving..." : "Record payment"}</button></div>
      </form>
    </CrudModal>
  );
}

function Field({ label, error, children }) {
  return <label className="block"><span className="premium-label">{label}</span><div className="mt-2">{children}</div>{error && <span className="mt-1 block text-xs font-semibold text-rose-500">{error}</span>}</label>;
}
