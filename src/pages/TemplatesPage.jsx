import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Eye, FileCode2, FileUp, LayoutTemplate, Maximize2,
  Minus, Pencil, Plus, Printer, Trash2, ZoomIn, ZoomOut, X
} from "lucide-react";
import toast from "react-hot-toast";
import { useAppStore } from "../store/appStore.js";
import { PageHeader } from "../components/ui.jsx";
import CrudModal from "../components/CrudModal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Skeleton from "../components/Skeleton.jsx";
import { calculateInvoice, formatMoney } from "../lib/invoice.js";

// ─── Zod Schema ──────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  description: z.string().optional(),
  accentColor: z.string().min(4),
  thumbnail: z.string().optional(),
  htmlContent: z.string().optional(),
  uploadedImageUrl: z.string().optional(),
  templateType: z.enum(["html", "image", "builtin"]).optional(),
});

// ─── Sample assets (SVG data URIs) ───────────────────────────────────────────
const sampleLogo = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="64" viewBox="0 0 180 64"><rect width="64" height="64" rx="14" fill="#2563EB"/><path d="M19 42V22h8l7 11 7-11h8v20h-7V31l-6 9h-4l-6-9v11z" fill="white"/><text x="78" y="28" font-family="Inter,Arial" font-size="18" font-weight="800" fill="#0f172a">Web</text><text x="78" y="48" font-family="Inter,Arial" font-size="18" font-weight="800" fill="#2563EB">Cultivation</text></svg>`
)}`;

const sampleSignature = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="72" viewBox="0 0 220 72"><path d="M8 48c24-30 33-31 28-3 18-18 29-22 32-10 2 8-5 16 7 7 20-15 28-17 33-7 4 8-5 16 12 5 24-16 37-18 51-8" fill="none" stroke="#111827" stroke-width="4" stroke-linecap="round"/><path d="M24 60h170" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/><text x="42" y="18" font-family="Inter,Arial" font-size="12" font-weight="700" fill="#475569">Authorized Signature</text></svg>`
)}`;

const sampleQr = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112" viewBox="0 0 112 112" shape-rendering="crispEdges"><rect width="112" height="112" fill="white"/><path fill="#111827" d="M8 8h28v28H8zM16 16v12h12V16zM76 8h28v28H76zM84 16v12h12V16zM8 76h28v28H8zM16 84v12h12V84zM48 8h8v8h-8zM64 8h4v12h-4zM44 20h16v4H44zM52 28h8v8h-8zM68 32h4v8h-4zM44 44h8v8h-8zM56 44h4v4h-4zM68 44h12v4H68zM88 44h8v8h-8zM40 56h16v4H40zM64 56h8v8h-8zM80 56h24v4H80zM44 68h4v12h-4zM56 68h20v4H56zM84 68h8v8h-8zM96 72h8v12h-8zM44 84h8v8h-8zM60 84h8v20h-8zM72 84h12v4H72zM88 92h16v12H88zM48 100h8v4h-8z"/></svg>`
)}`;

// ─── Sample invoice data ──────────────────────────────────────────────────────
const previewInvoiceBase = {
  invoiceNumber: "INV-2026-0148",
  issueDate: "2026-05-29",
  dueDate: "2026-06-12",
  status: "Sent",
  currency: "INR",
  clientSnapshot: {
    name: "Aarav Industries Pvt. Ltd.",
    email: "accounts@aaravindustries.in",
    address: "7th Floor, Meridian Business Park, Andheri East, Mumbai, Maharashtra 400069",
    billingAddress: "7th Floor, Meridian Business Park, Andheri East, Mumbai, Maharashtra 400069",
    shippingAddress: "Warehouse 4B, Bhiwandi Logistics Hub, Maharashtra 421302",
    taxId: "GSTIN 27AARCA4821L1Z5",
  },
  company: {
    name: "Web Cultivation",
    email: "billing@webcultivation.com",
    address: "21 Innovation Street, Indiranagar, Bengaluru, Karnataka 560038",
    logo: sampleLogo,
    signature: sampleSignature,
  },
  items: [
    { name: "SaaS dashboard design", description: "Invoice analytics, role dashboards, and responsive UI kit", quantity: 1, price: 42000, tax: 18, discount: 5 },
    { name: "Backend integration", description: "API wiring, PDF export, email workflow, and audit logs", quantity: 1, price: 36000, tax: 18, discount: 0 },
    { name: "Production support", description: "Launch support and template QA", quantity: 6, price: 2500, tax: 18, discount: 0 },
  ],
  paymentTerms: "Payment due within 14 days from invoice date.",
  paymentMethod: "Bank Transfer",
  notes: "Thank you for your business. Please include the invoice number in the payment reference.",
  terms: "Late payments may attract charges as per the service agreement.",
  bank: {
    bankName: "HDFC Bank",
    accountNo: "50200012345678",
    ifsc: "HDFC0001234",
    accountName: "Web Cultivation",
  },
  qrPaymentUrl: sampleQr,
};

const sampleInvoice = {
  ...previewInvoiceBase,
  ...calculateInvoice(previewInvoiceBase.items),
};

// ─── Items table builder ──────────────────────────────────────────────────────
function buildItemsTable(items, currency) {
  const rows = items
    .map(
      (item) => `
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:10px 14px">
          <strong style="display:block;font-size:13px;color:#0f172a">${item.name}</strong>
          <small style="font-size:11px;color:#64748b">${item.description || ""}</small>
        </td>
        <td style="padding:10px 14px;text-align:center;font-size:13px">${item.quantity}</td>
        <td style="padding:10px 14px;text-align:right;font-size:13px">${formatMoney(item.price)}</td>
        <td style="padding:10px 14px;text-align:right;font-size:13px">${item.discount ?? 0}%</td>
        <td style="padding:10px 14px;text-align:right;font-size:13px">${item.tax}%</td>
        <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:600;color:#0f172a">
          ${currency} ${formatMoney(item.quantity * item.price)}
        </td>
      </tr>`
    )
    .join("");

  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:20px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700">Item</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700">Qty</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700">Rate</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700">Disc.</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700">Tax</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ─── Field preview map ────────────────────────────────────────────────────────
const fieldPreviewData = {
  "{{company.logo}}": `<img src="${sampleInvoice.company.logo}" alt="Logo" style="height:48px;margin-bottom:4px" />`,
  "{{company.name}}": sampleInvoice.company.name,
  "{{company.email}}": sampleInvoice.company.email,
  "{{company.address}}": sampleInvoice.company.address,
  "{{company.signature}}": `<img src="${sampleInvoice.company.signature}" alt="Signature" style="height:56px" />`,
  "{{invoice.number}}": sampleInvoice.invoiceNumber,
  "{{invoice.status}}": sampleInvoice.status,
  "{{invoice.date}}": sampleInvoice.issueDate,
  "{{invoice.dueDate}}": sampleInvoice.dueDate,
  "{{invoice.currency}}": sampleInvoice.currency,
  "{{invoice.subtotal}}": formatMoney(sampleInvoice.subtotal),
  "{{invoice.discount}}": formatMoney(sampleInvoice.discount),
  "{{invoice.tax}}": formatMoney(sampleInvoice.tax),
  "{{tax.total}}": formatMoney(sampleInvoice.tax),
  "{{invoice.total}}": formatMoney(sampleInvoice.total),
  "{{invoice.notes}}": sampleInvoice.notes,
  "{{invoice.terms}}": sampleInvoice.terms,
  "{{invoice.paymentTerms}}": sampleInvoice.paymentTerms,
  "{{client.name}}": sampleInvoice.clientSnapshot.name,
  "{{client.email}}": sampleInvoice.clientSnapshot.email,
  "{{client.address}}": sampleInvoice.clientSnapshot.billingAddress,
  "{{client.taxId}}": sampleInvoice.clientSnapshot.taxId,
  "{{bank.name}}": sampleInvoice.bank.bankName,
  "{{bank.accountNo}}": sampleInvoice.bank.accountNo,
  "{{bank.ifsc}}": sampleInvoice.bank.ifsc,
  "{{payment.qr}}": `<img src="${sampleInvoice.qrPaymentUrl}" alt="QR Code" style="width:80px;height:80px;margin-top:8px;border-radius:6px" />`,
  "{{items.table}}": buildItemsTable(sampleInvoice.items, sampleInvoice.currency),
};

// ─── Default HTML template ────────────────────────────────────────────────────
const defaultHtmlTemplate = `<div class="invoice-document">
  <header class="invoice-header">
    <div>
      {{company.logo}}
      <h1>{{company.name}}</h1>
      <p>{{company.email}}</p>
      <p>{{company.address}}</p>
    </div>
    <div class="invoice-title-block">
      <span>{{invoice.status}}</span>
      <h2>INVOICE</h2>
      <p>{{invoice.number}}</p>
    </div>
  </header>
  <section class="invoice-meta-grid">
    <div>
      <span class="section-label">Bill To</span>
      <h3>{{client.name}}</h3>
      <p>{{client.email}}</p>
      <p>{{client.address}}</p>
      <p>{{client.taxId}}</p>
    </div>
    <div class="invoice-dates">
      <p><strong>Invoice date</strong><span>{{invoice.date}}</span></p>
      <p><strong>Due date</strong><span>{{invoice.dueDate}}</span></p>
      <p><strong>Currency</strong><span>{{invoice.currency}}</span></p>
    </div>
  </section>
  {{items.table}}
  <section class="invoice-bottom-grid">
    <div>
      <span class="section-label">Payment Details</span>
      <p>{{bank.name}}</p>
      <p>Account: {{bank.accountNo}}</p>
      <p>IFSC / Swift: {{bank.ifsc}}</p>
      <p>{{invoice.paymentTerms}}</p>
      {{payment.qr}}
    </div>
    <div class="totals-panel">
      <p><span>Subtotal</span><strong>{{invoice.currency}} {{invoice.subtotal}}</strong></p>
      <p><span>Discount</span><strong>-{{invoice.currency}} {{invoice.discount}}</strong></p>
      <p><span>GST / VAT</span><strong>{{invoice.currency}} {{invoice.tax}}</strong></p>
      <p class="grand-total"><span>Total</span><strong>{{invoice.currency}} {{invoice.total}}</strong></p>
    </div>
  </section>
  <footer class="invoice-footer">
    <div>
      <strong>Notes</strong>
      <p>{{invoice.notes}}</p>
      <p>{{invoice.terms}}</p>
    </div>
    <div class="signature-block">
      {{company.signature}}
      <span>Authorized signature</span>
    </div>
  </footer>
</div>`;

const templateFormDefaults = {
  name: "",
  category: "Business",
  description: "",
  accentColor: "#2563EB",
  thumbnail: "",
  uploadedImageUrl: "",
  htmlContent: defaultHtmlTemplate,
  templateType: "html",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function previewLabel(field) {
  return field
    .replace(/^\{\{|\}\}$/g, "")
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function renderSampleHtml(html) {
  return Object.entries(fieldPreviewData).reduce(
    (content, [key, value]) => content.replaceAll(key, value),
    html
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TemplatesPage() {
  const { templates, loading, fetchTemplates, saveTemplate, deleteTemplate, uploadFile } =
    useAppStore();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mappingFields, setMappingFields] = useState([
    "{{invoice.number}}",
    "{{client.name}}",
    "{{items.table}}",
    "{{tax.total}}",
    "{{payment.qr}}",
  ]);
  const [customField, setCustomField] = useState("");

  useEffect(() => {
    fetchTemplates().catch((error) => toast.error(error.message));
  }, []);

  const copyField = async (field) => {
    try {
      await navigator.clipboard.writeText(field);
      toast.success("Copied!");
    } catch {
      toast.error("Copy failed");
    }
  };

  const addCustomField = (event) => {
    event.preventDefault();
    const cleaned = customField
      .trim()
      .replace(/^\{\{|\}\}$/g, "")
      .replace(/\s+/g, ".");
    if (!cleaned) return;
    const nextField = `{{${cleaned}}}`;
    if (!mappingFields.includes(nextField))
      setMappingFields((fields) => [...fields, nextField]);
    setCustomField("");
  };

  return (
    <>
      <PageHeader
        eyebrow="Reusable invoice design"
        title="Invoice Templates"
        description="Upload designs, map dynamic fields, preview layouts, and publish reusable branded invoice templates."
        action={
          <button
            className="premium-btn"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <FileUp className="h-4 w-4" /> Upload template
          </button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── Template grid ── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {loading.templates ? (
            <div className="col-span-full">
              <Skeleton />
            </div>
          ) : (
            templates.map((template) => (
              <TemplateCard
                key={template._id}
                template={template}
                onPreview={() => setPreview(template)}
                onEdit={() => {
                  setEditing(template);
                  setOpen(true);
                }}
                onDelete={() => setDeleting(template)}
              />
            ))
          )}
          {!loading.templates && !templates.length && (
            <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 py-16 dark:border-slate-700 dark:bg-slate-900/40">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                <LayoutTemplate className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-500">No templates uploaded yet.</p>
              <button
                className="secondary-btn px-4 py-2 text-sm"
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Create your first template
              </button>
            </div>
          )}
        </div>

        {/* ── Dynamic fields sidebar ── */}
        <aside className="premium-card p-4 xl:sticky xl:top-24 xl:self-start">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-500/10">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black">Dynamic fields</h2>
              <p className="text-xs text-slate-500">Click a field to copy it.</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {mappingFields.map((field) => (
              <button
                key={field}
                type="button"
                className="w-full rounded-md border border-dashed border-slate-300 bg-slate-50 p-2.5 text-left font-mono text-xs transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-500 dark:hover:bg-blue-500/10"
                onClick={() => copyField(field)}
              >
                {field}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="premium-label">Preview</p>
                <h3 className="mt-1 text-sm font-black">Field map</h3>
              </div>
              <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                Draft
              </span>
            </div>
            <div className="mt-3 grid gap-1.5 text-sm">
              {mappingFields.map((field) => (
                <div
                  key={`preview-${field}`}
                  className="flex items-center justify-between gap-3 rounded-md bg-white px-2.5 py-2 dark:bg-slate-900"
                >
                  <span className="text-slate-500">{previewLabel(field)}</span>
                  <span className="truncate font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {field}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <form className="mt-4" onSubmit={addCustomField}>
            <span className="premium-label">Add custom field</span>
            <div className="mt-2 flex gap-2">
              <input
                className="premium-input min-w-0 flex-1 py-2.5"
                value={customField}
                onChange={(event) => setCustomField(event.target.value)}
                placeholder="field.name"
              />
              <button
                className="secondary-btn px-3 py-2.5"
                type="submit"
                aria-label="Add custom field"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </form>
        </aside>
      </div>

      {/* ── Template form modal ── */}
      <TemplateForm
        open={open}
        template={editing}
        uploadFile={uploadFile}
        onClose={() => setOpen(false)}
        onSave={async (values) => {
          try {
            await saveTemplate(
              {
                ...values,
                templateType: "html",
                fields: [
                  { label: "Invoice Number", key: "invoiceNumber", required: true },
                  { label: "Items", key: "items", required: true },
                ],
              },
              editing?._id
            );
            toast.success(editing ? "Template updated" : "Template created");
            setOpen(false);
          } catch (error) {
            toast.error(error.message);
          }
        }}
      />

      {/* ── Preview modal ── */}
      <CrudModal
        open={Boolean(preview)}
        title={preview?.name}
        onClose={() => setPreview(null)}
        width="max-w-4xl"
      >
        <div className="flex flex-col gap-3">
          {/* Meta bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2.5 text-xs">
              <span className="premium-label">{preview?.category}</span>
              {preview?.description && (
                <>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="text-slate-500">{preview.description}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="h-3 w-3 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: preview?.accentColor || "#2563EB" }}
              />
              <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                {preview?.accentColor || "#2563EB"}
              </span>
            </div>
          </div>

          {/* Rendered HTML preview */}
          <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto max-w-[794px]">
              <div
                className="template-paper-frame"
                dangerouslySetInnerHTML={{
                  __html: renderSampleHtml(
                    preview?.htmlContent ||
                      `<p style="padding:2rem;color:#94a3b8;text-align:center;font-family:sans-serif">
                        No HTML content defined for this template.
                      </p>`
                  ),
                }}
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex justify-end gap-2">
            <button
              className="secondary-btn px-4 py-2.5"
              onClick={() => {
                setPreview(null);
                setEditing(preview);
                setOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit template
            </button>
            <button className="secondary-btn px-4 py-2.5" onClick={() => setPreview(null)}>
              Close
            </button>
          </div>
        </div>
      </CrudModal>

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete template"
        description={`Delete "${deleting?.name}"? This action cannot be undone.`}
        busy={loading.templates}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await deleteTemplate(deleting._id);
            toast.success("Template deleted");
            setDeleting(null);
          } catch (error) {
            toast.error(error.message);
          }
        }}
      />
    </>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────
function TemplateCard({ template, onPreview, onEdit, onDelete }) {
  return (
    <div className="group premium-card overflow-hidden p-0 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
      {/* Thumbnail */}
      <div
        className="relative h-40 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${template.accentColor || "#2563EB"}1a 0%, #f8fafc 100%)`,
        }}
      >
        {template.thumbnail ? (
          <img
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            src={template.thumbnail}
            alt={template.name}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4">
            <div className="w-full rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm">
              <div className="h-2 w-20 rounded-full" style={{ backgroundColor: template.accentColor || "#2563EB" }} />
              <div className="mt-4 space-y-1.5">
                <div className="h-1.5 w-3/4 rounded-full bg-slate-200" />
                <div className="h-1.5 w-2/3 rounded-full bg-slate-200" />
                <div className="h-1.5 w-5/6 rounded-full bg-slate-200" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-1.5">
                <div className="h-7 rounded bg-slate-100" />
                <div className="h-7 rounded bg-slate-100" />
                <div className="h-7 rounded bg-slate-100" />
              </div>
            </div>
          </div>
        )}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ backgroundColor: template.accentColor || "#2563EB" }}
        />
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/20 group-hover:opacity-100 cursor-pointer"
          onClick={onPreview}
        >
          <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-slate-800 shadow">
            <Eye className="h-3.5 w-3.5" /> Quick preview
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="premium-label">{template.category}</p>
            <h3 className="mt-1 truncate text-base font-black leading-tight">{template.name}</h3>
          </div>
          <div
            className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-white shadow-sm"
            style={{ backgroundColor: template.accentColor || "#2563EB" }}
          />
        </div>
        <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-sm leading-5 text-slate-500">
          {template.description || "Reusable invoice template"}
        </p>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          {/* Preview — full width */}
          <button
            className="secondary-btn flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold"
            onClick={onPreview}
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>

          {/* Edit */}
          <button
            className="secondary-btn px-3 py-2 hover:border-blue-400 hover:text-blue-600"
            title="Edit template"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </button>

          {/* Delete */}
          <button
            className="secondary-btn px-3 py-2 text-rose-500 hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
            title="Delete template"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
// ─── Template Form ────────────────────────────────────────────────────────────
function TemplateForm({ open, template, uploadFile, onClose, onSave }) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: template
      ? { ...templateFormDefaults, ...template, htmlContent: template.htmlContent || defaultHtmlTemplate }
      : templateFormDefaults,
  });

  const htmlContent = watch("htmlContent");
  const renderedPreview = useMemo(() => renderSampleHtml(htmlContent || ""), [htmlContent]);

  useEffect(() => {
    reset(
      template
        ? { ...templateFormDefaults, ...template, htmlContent: template.htmlContent || defaultHtmlTemplate }
        : templateFormDefaults
    );
  }, [template, reset, open]);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = await uploadFile(file);
      setValue("thumbnail", data.url);
      toast.success("Template image uploaded");
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <CrudModal
      open={open}
      title={template ? "Edit template" : "Upload template"}
      onClose={onClose}
      width="max-w-[1180px] max-h-[calc(100vh-2rem)] overflow-hidden"
    >
      <form
        onSubmit={handleSubmit(onSave)}
        className="template-builder-grid max-h-[calc(100vh-8rem)] overflow-y-auto pr-1"
      >
        {/* ── Left: controls ── */}
        <section className="template-control-panel">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-500/10">
                <FileCode2 className="h-5 w-5" />
              </div>
              <div>
                <p className="premium-label">Template details</p>
                <h3 className="text-sm font-black">Name, category, and branding</h3>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" error={errors.name?.message}>
                <input className="premium-input py-2.5" {...register("name")} />
              </Field>
              <Field label="Category" error={errors.category?.message}>
                <input className="premium-input py-2.5" {...register("category")} />
              </Field>
              <Field label="Accent color">
                <input className="premium-input h-11 py-1.5" type="color" {...register("accentColor")} />
              </Field>
              <label className="secondary-btn mt-6 cursor-pointer py-2.5">
                <FileUp className="h-4 w-4" /> Upload thumbnail
                <input className="hidden" type="file" accept="image/*" onChange={upload} />
              </label>
            </div>
            <label className="mt-3 block">
              <span className="premium-label">Description</span>
              <textarea
                className="premium-input mt-2 min-h-20 rounded-md py-2.5"
                {...register("description")}
              />
            </label>
            <input type="hidden" {...register("thumbnail")} />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <span className="premium-label">Design structure</span>
                <h3 className="mt-1 text-sm font-black">HTML template</h3>
              </div>
              <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                Live
              </span>
            </div>
            <textarea
              className="premium-input min-h-[360px] resize-y rounded-md font-mono text-xs leading-5 lg:min-h-[420px]"
              spellCheck="false"
              placeholder="<div>{{invoice.number}}</div>"
              {...register("htmlContent")}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="secondary-btn px-4 py-2.5" onClick={onClose}>
              Cancel
            </button>
            <button className="premium-btn px-4 py-2.5" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save template"}
            </button>
          </div>
        </section>

        {/* ── Right: live preview ── */}
        <aside className="template-preview-panel">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="premium-label">Fit preview</p>
              <h3 className="text-sm font-black">A4 invoice canvas</h3>
            </div>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Auto fit
            </span>
          </div>
          <div className="template-preview-viewport">
            <div className="template-preview-shell">
              <div
                className="template-paper-frame"
                dangerouslySetInnerHTML={{ __html: renderedPreview }}
              />
            </div>
          </div>
        </aside>
      </form>
    </CrudModal>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="premium-label">{label}</span>
      <div className="mt-2">{children}</div>
      {error && <span className="mt-1 block text-xs font-semibold text-rose-500">{error}</span>}
    </label>
  );
}