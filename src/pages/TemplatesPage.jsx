import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Eye, FileUp, LayoutTemplate, Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAppStore } from "../store/appStore.js";
import { PageHeader } from "../components/ui.jsx";
import CrudModal from "../components/CrudModal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Skeleton from "../components/Skeleton.jsx";

const schema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  description: z.string().optional(),
  accentColor: z.string().min(4),
  thumbnail: z.string().optional(),
  htmlContent: z.string().optional()
});

const fieldPreviewData = {
  "{{invoice.number}}": "INV-2025-00001",
  "{{invoice.date}}": "2025-01-15",
  "{{invoice.dueDate}}": "2025-01-30",
  "{{invoice.status}}": "Paid",
  "{{invoice.currency}}": "INR",
  "{{invoice.subtotal}}": "10,000.00",
  "{{invoice.tax}}": "1,800.00",
  "{{invoice.discount}}": "500.00",
  "{{invoice.total}}": "11,300.00",
  "{{client.name}}": "Acme Corp",
  "{{client.email}}": "billing@acme.com",
  "{{client.address}}": "123 Business Park, Mumbai",
  "{{client.taxId}}": "GSTIN12345",
  "{{company.name}}": "My Company Ltd",
  "{{company.email}}": "hello@mycompany.com",
  "{{company.address}}": "456 Tech Hub, Bangalore",
  "{{items.table}}": "<table style=\"width:100%;border-collapse:collapse\"><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody><tr><td>Design Service</td><td>2</td><td>5,000</td><td>10,000</td></tr></tbody></table>",
  "{{bank.name}}": "HDFC Bank",
  "{{bank.accountNo}}": "1234567890",
  "{{bank.ifsc}}": "HDFC0001234",
  "{{payment.qr}}": "<img src=\"https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=upi://pay\" />"
};

const defaultHtmlTemplate = `<div style="font-family:Inter,Arial,sans-serif;padding:32px;color:#111827">
  <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e5e7eb;padding-bottom:20px">
    <div>
      <h1 style="margin:0;font-size:28px">{{company.name}}</h1>
      <p style="margin:6px 0;color:#6b7280">{{company.email}}</p>
      <p style="margin:0;color:#6b7280">{{company.address}}</p>
    </div>
    <div style="text-align:right">
      <h2 style="margin:0;color:#2563eb;font-size:32px">INVOICE</h2>
      <p style="font-weight:700">{{invoice.number}}</p>
      <p>{{invoice.status}}</p>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:28px 0">
    <div>
      <p style="font-size:12px;text-transform:uppercase;color:#6b7280">Bill to</p>
      <h3>{{client.name}}</h3>
      <p>{{client.email}}</p>
      <p>{{client.address}}</p>
      <p>{{client.taxId}}</p>
    </div>
    <div>
      <p><strong>Date:</strong> {{invoice.date}}</p>
      <p><strong>Due:</strong> {{invoice.dueDate}}</p>
      <p><strong>Currency:</strong> {{invoice.currency}}</p>
    </div>
  </div>
  {{items.table}}
  <div style="margin-top:24px;text-align:right">
    <p>Subtotal: {{invoice.subtotal}}</p>
    <p>Tax: {{invoice.tax}}</p>
    <h2>Total: {{invoice.currency}} {{invoice.total}}</h2>
  </div>
</div>`;

const templateFormDefaults = { name: "", category: "Business", description: "", accentColor: "#2563EB", thumbnail: "", htmlContent: defaultHtmlTemplate };

export default function TemplatesPage() {
  const { templates, loading, fetchTemplates, saveTemplate, deleteTemplate, uploadFile } = useAppStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mappingFields, setMappingFields] = useState(["{{invoice.number}}", "{{client.name}}", "{{items.table}}", "{{tax.total}}", "{{payment.qr}}"]);
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
    const cleaned = customField.trim().replace(/^\{\{|\}\}$/g, "").replace(/\s+/g, ".");
    if (!cleaned) return;
    const nextField = `{{${cleaned}}}`;
    if (!mappingFields.includes(nextField)) setMappingFields((fields) => [...fields, nextField]);
    setCustomField("");
  };

  return (
    <>
      <PageHeader
        eyebrow="Reusable invoice design"
        title="Invoice Templates"
        description="Upload designs, map dynamic fields, preview layouts, and publish reusable branded invoice templates."
        action={<button className="premium-btn" onClick={() => { setEditing(null); setOpen(true); }}><FileUp className="h-4 w-4" /> Upload template</button>}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4 md:grid-cols-3">
          {loading.templates ? <div className="col-span-full"><Skeleton /></div> : templates.map((template) => (
            <div key={template._id} className="group premium-card overflow-hidden p-0">
              <div className="h-44 p-5" style={{ background: `linear-gradient(135deg, ${template.accentColor || "#2563EB"}22, #ffffff)` }}>
                {template.thumbnail ? <img className="h-full w-full rounded-2xl object-cover shadow-soft" src={template.thumbnail} alt={template.name} /> : (
                  <div className="h-full rounded-2xl border border-white/70 bg-white/86 p-4 shadow-soft">
                    <div className="h-3 w-24 rounded-full" style={{ backgroundColor: template.accentColor || "#2563EB" }} />
                    <div className="mt-8 space-y-2"><div className="h-2 w-3/4 rounded-full bg-slate-200" /><div className="h-2 w-2/3 rounded-full bg-slate-200" /><div className="h-2 w-5/6 rounded-full bg-slate-200" /></div>
                    <div className="mt-8 grid grid-cols-3 gap-2"><div className="h-12 rounded-xl bg-slate-100" /><div className="h-12 rounded-xl bg-slate-100" /><div className="h-12 rounded-xl bg-slate-100" /></div>
                  </div>
                )}
              </div>
              <div className="p-5">
                <p className="premium-label">{template.category}</p>
                <h3 className="mt-2 text-lg font-black">{template.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{template.description || "Reusable invoice template"}</p>
                <div className="mt-5 flex gap-2">
                  <button className="secondary-btn flex-1 px-3 py-2" onClick={() => setPreview(template)}><Eye className="h-4 w-4" /> Preview</button>
                  <button className="secondary-btn px-3 py-2" onClick={() => { setEditing(template); setOpen(true); }}><Pencil className="h-4 w-4" /></button>
                  <button className="secondary-btn px-3 py-2 text-rose-500" onClick={() => setDeleting(template)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
          {!loading.templates && !templates.length && <p className="col-span-full py-12 text-center text-slate-500">No templates uploaded yet.</p>}
        </div>
        <aside className="premium-card">
          <LayoutTemplate className="h-8 w-8 text-blue-600" />
          <h2 className="mt-4 text-xl font-black">Dynamic field mapping</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Template field definitions are stored with each template and can be used by the invoice renderer and PDF generator.</p>
          <div className="mt-6 space-y-3">
            {mappingFields.map((field) => (
              <button
                key={field}
                type="button"
                className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-left font-mono text-sm transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-500 dark:hover:bg-blue-500/10"
                onClick={() => copyField(field)}
              >
                {field}
              </button>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="premium-label">Preview</p>
              <h3 className="mt-2 text-base font-black">Field map</h3>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">Draft</span>
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              {mappingFields.map((field) => (
                <div key={`preview-${field}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 dark:bg-slate-900">
                  <span className="text-slate-500">{previewLabel(field)}</span>
                  <span className="truncate font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{field}</span>
                </div>
              ))}
            </div>
          </div>
          <form className="mt-6" onSubmit={addCustomField}>
            <span className="premium-label">Add custom field</span>
            <div className="mt-2 flex gap-2">
              <input
                className="premium-input min-w-0 flex-1"
                value={customField}
                onChange={(event) => setCustomField(event.target.value)}
                placeholder="field.name"
              />
              <button className="secondary-btn px-3" type="submit" aria-label="Add custom field">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </form>
        </aside>
      </div>

      <TemplateForm open={open} template={editing} uploadFile={uploadFile} onClose={() => setOpen(false)} onSave={async (values) => {
        try {
          await saveTemplate({ ...values, templateType: "html", fields: [{ label: "Invoice Number", key: "invoiceNumber", required: true }, { label: "Items", key: "items", required: true }] }, editing?._id);
          toast.success(editing ? "Template updated" : "Template created");
          setOpen(false);
        } catch (error) {
          toast.error(error.message);
        }
      }} />
      <CrudModal open={Boolean(preview)} title={preview?.name} onClose={() => setPreview(null)}>
        <div className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
          <p className="premium-label">{preview?.category}</p>
          <p className="mt-3 text-sm text-slate-500">{preview?.description}</p>
          <div className="mt-6 rounded-2xl bg-slate-50 p-6 dark:bg-slate-900">
            <div className="h-3 w-32 rounded-full" style={{ backgroundColor: preview?.accentColor }} />
            <div className="mt-8 grid gap-3"><div className="h-4 rounded-full bg-slate-200 dark:bg-slate-800" /><div className="h-4 w-3/4 rounded-full bg-slate-200 dark:bg-slate-800" /><div className="h-24 rounded-2xl bg-white dark:bg-slate-950" /></div>
          </div>
        </div>
      </CrudModal>
      <ConfirmDialog open={Boolean(deleting)} title="Delete template" description={`Delete ${deleting?.name}?`} busy={loading.templates} onCancel={() => setDeleting(null)} onConfirm={async () => {
        try {
          await deleteTemplate(deleting._id);
          toast.success("Template deleted");
          setDeleting(null);
        } catch (error) {
          toast.error(error.message);
        }
      }} />
    </>
  );
}

function TemplateForm({ open, template, uploadFile, onClose, onSave }) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), defaultValues: template ? { ...templateFormDefaults, ...template, htmlContent: template.htmlContent || defaultHtmlTemplate } : templateFormDefaults });
  const htmlContent = watch("htmlContent");
  const renderedPreview = useMemo(() => renderSampleHtml(htmlContent || ""), [htmlContent]);

  useEffect(() => {
    reset(template ? { ...templateFormDefaults, ...template, htmlContent: template.htmlContent || defaultHtmlTemplate } : templateFormDefaults);
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
    <CrudModal open={open} title={template ? "Edit template" : "Upload template"} onClose={onClose}>
      <form onSubmit={handleSubmit(onSave)} className="grid gap-4 md:grid-cols-2">
        <Field label="Name" error={errors.name?.message}><input className="premium-input" {...register("name")} /></Field>
        <Field label="Category" error={errors.category?.message}><input className="premium-input" {...register("category")} /></Field>
        <Field label="Accent color"><input className="premium-input" type="color" {...register("accentColor")} /></Field>
        <label className="secondary-btn mt-6 cursor-pointer"><FileUp className="h-4 w-4" /> Upload thumbnail<input className="hidden" type="file" accept="image/*" onChange={upload} /></label>
        <label className="block md:col-span-2"><span className="premium-label">Description</span><textarea className="premium-input mt-2 min-h-24" {...register("description")} /></label>
        <section className="md:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <span className="premium-label">Design</span>
              <h3 className="mt-1 text-base font-black">HTML template</h3>
            </div>
            <span className="rounded-md bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">Live preview</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <textarea
              className="premium-input min-h-[420px] resize-y font-mono text-xs leading-5"
              spellCheck="false"
              placeholder="<div>{{invoice.number}}</div>"
              {...register("htmlContent")}
            />
            <div className="min-h-[420px] overflow-auto rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="mx-auto min-h-[390px] max-w-[794px] bg-white text-slate-950 shadow-soft" dangerouslySetInnerHTML={{ __html: renderedPreview }} />
            </div>
          </div>
        </section>
        <input type="hidden" {...register("thumbnail")} />
        <div className="flex justify-end gap-3 md:col-span-2"><button type="button" className="secondary-btn" onClick={onClose}>Cancel</button><button className="premium-btn" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save template"}</button></div>
      </form>
    </CrudModal>
  );
}

function Field({ label, error, children }) {
  return <label className="block"><span className="premium-label">{label}</span><div className="mt-2">{children}</div>{error && <span className="mt-1 block text-xs font-semibold text-rose-500">{error}</span>}</label>;
}

function previewLabel(field) {
  return field.replace(/^\{\{|\}\}$/g, "").split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function renderSampleHtml(html) {
  return Object.entries(fieldPreviewData).reduce((content, [key, value]) => content.replaceAll(key, value), html);
}
