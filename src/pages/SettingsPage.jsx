import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDropzone } from "react-dropzone";
import { useForm } from "react-hook-form";
import { QRCodeSVG } from "qrcode.react";
import { z } from "zod";
import { Bell, Building2, Copy, ImagePlus, Mail, Percent, ReceiptText, Save, WalletCards } from "lucide-react";
import toast from "react-hot-toast";
import { CustomSelect, PageHeader } from "../components/ui.jsx";
import { useAppStore } from "../store/appStore.js";
import Skeleton from "../components/Skeleton.jsx";

const tabs = [
  ["profile", "Company Profile", Building2],
  ["invoice", "Invoice Preferences", ReceiptText],
  ["payment", "Payment Settings", WalletCards],
  ["tax", "Tax Settings", Percent],
  ["email", "Email Settings", Mail],
  ["notifications", "Notifications", Bell]
];

const schema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  companyEmail: z.string().email("Valid email required").optional().or(z.literal("")),
  companyPhone: z.string().optional(),
  companyAddress: z.string().optional(),
  companyWebsite: z.string().optional(),
  GSTIN: z.string().optional(),
  PAN: z.string().optional(),
  CIN: z.string().optional(),
  logo: z.string().optional(),
  defaultCurrency: z.string().min(2),
  invoicePrefix: z.string().min(2),
  defaultDueDays: z.coerce.number().min(1),
  defaultNotes: z.string().optional(),
  defaultTerms: z.string().optional(),
  upiId: z.string().optional(),
  bank: z.object({ accountName: z.string().optional(), accountNo: z.string().optional(), ifsc: z.string().optional(), bankName: z.string().optional() }),
  paymentMethods: z.object({ UPI: z.boolean(), Cash: z.boolean(), Bank: z.boolean(), Card: z.boolean() }),
  taxRate: z.coerce.number().min(0),
  taxEnabled: z.boolean(),
  taxLabel: z.string().min(2),
  emailSettings: z.object({
    smtpHost: z.string().optional(),
    smtpPort: z.coerce.number().optional(),
    smtpUser: z.string().optional(),
    smtpPassword: z.string().optional(),
    fromName: z.string().optional(),
    fromEmail: z.string().optional(),
    subjectTemplate: z.string().optional(),
    bodyTemplate: z.string().optional()
  }),
  notifications: z.object({ invoiceSent: z.boolean(), paymentReceived: z.boolean(), overdueAlerts: z.boolean(), alertDaysBeforeDue: z.coerce.number().min(0) })
});

export default function SettingsPage() {
  const { settings, loading, fetchSettings, saveSettings } = useAppStore();
  const [active, setActive] = useState("profile");
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaults()
  });

  useEffect(() => {
    fetchSettings().catch((error) => toast.error(error.message));
  }, []);

  useEffect(() => {
    if (settings) reset(defaults(settings));
  }, [settings, reset]);

  const submit = async (values) => {
    try {
      await saveSettings({ ...values, currency: values.defaultCurrency });
      toast.success("Settings saved");
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading.settings && !settings) return <Skeleton rows={5} />;

  return (
    <form onSubmit={handleSubmit(submit)}>
      <PageHeader
        eyebrow="Workspace controls"
        title="Settings"
        description="Manage company identity, invoice defaults, payments, tax, email delivery, and notification preferences."
        action={<button className="premium-btn rounded-xl" disabled={isSubmitting}><Save className="h-4 w-4" /> {isSubmitting ? "Saving..." : "Save changes"}</button>}
      />
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="premium-card rounded-xl p-2">
          {tabs.map(([key, label, Icon]) => (
            <button key={key} type="button" className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${active === key ? "bg-blue-600 text-white shadow-glow" : "text-slate-600 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-blue-500/10"}`} onClick={() => setActive(key)}>
              <Icon className="h-5 w-5" /> {label}
            </button>
          ))}
        </aside>
        <section className="premium-card rounded-xl">
          {active === "profile" && <ProfileTab register={register} setValue={setValue} watch={watch} errors={errors} />}
          {active === "invoice" && <InvoiceTab register={register} setValue={setValue} watch={watch} />}
          {active === "payment" && <PaymentTab register={register} watch={watch} />}
          {active === "tax" && <TaxTab register={register} setValue={setValue} watch={watch} />}
          {active === "email" && <EmailTab register={register} />}
          {active === "notifications" && <NotificationsTab register={register} />}
        </section>
      </div>
    </form>
  );
}

function defaults(settings = {}) {
  return {
    companyName: settings.companyName || "InvoiceFlow",
    companyEmail: settings.companyEmail || "",
    companyPhone: settings.companyPhone || "",
    companyAddress: settings.companyAddress || "",
    companyWebsite: settings.companyWebsite || "",
    GSTIN: settings.GSTIN || "",
    PAN: settings.PAN || "",
    CIN: settings.CIN || "",
    logo: settings.logo || "",
    defaultCurrency: settings.defaultCurrency || settings.currency || "INR",
    invoicePrefix: settings.invoicePrefix || "INV",
    defaultDueDays: settings.defaultDueDays || 15,
    defaultNotes: settings.defaultNotes || "",
    defaultTerms: settings.defaultTerms || "",
    upiId: settings.upiId || "",
    bank: { accountName: "", accountNo: "", ifsc: "", bankName: "", ...settings.bank },
    paymentMethods: { UPI: true, Cash: true, Bank: true, Card: true, ...settings.paymentMethods },
    taxRate: settings.taxRate ?? 18,
    taxEnabled: settings.taxEnabled ?? true,
    taxLabel: settings.taxLabel || "GST",
    emailSettings: { smtpHost: "", smtpPort: 587, smtpUser: "", smtpPassword: "", fromName: "", fromEmail: "", subjectTemplate: "Invoice {{invoiceNumber}}", bodyTemplate: "", ...settings.emailSettings },
    notifications: { invoiceSent: true, paymentReceived: true, overdueAlerts: true, alertDaysBeforeDue: 3, ...settings.notifications }
  };
}

function ProfileTab({ register, setValue, watch, errors }) {
  const logo = watch("logo");
  return <div className="grid gap-5 xl:grid-cols-[240px_1fr]"><LogoDrop value={logo} onChange={(value) => setValue("logo", value, { shouldDirty: true })} /><div className="grid gap-4 md:grid-cols-2"><Input label="Company name" error={errors.companyName?.message} bind={register("companyName")} /><Input label="Email" error={errors.companyEmail?.message} bind={register("companyEmail")} /><Input label="Phone" bind={register("companyPhone")} /><Input label="Website" bind={register("companyWebsite")} /><Input label="GSTIN" bind={register("GSTIN")} /><Input label="PAN" bind={register("PAN")} /><Input label="CIN" bind={register("CIN")} /><label className="block md:col-span-2"><span className="premium-label">Address</span><textarea className="premium-input mt-2 min-h-28 rounded-xl" {...register("companyAddress")} /></label></div></div>;
}

function InvoiceTab({ register, setValue, watch }) {
  return <div className="grid gap-4 md:grid-cols-2"><CustomSelect label="Default currency" value={watch("defaultCurrency")} onChange={(value) => setValue("defaultCurrency", value, { shouldValidate: true })} options={["INR", "USD", "EUR", "GBP", "AED"]} /><Input label="Invoice prefix" bind={register("invoicePrefix")} /><CustomSelect label="Default due days" value={watch("defaultDueDays")} onChange={(value) => setValue("defaultDueDays", Number(value), { shouldValidate: true })} options={[7, 15, 30, 45, 60].map((value) => ({ label: `${value} days`, value }))} /><div className="rounded-xl bg-slate-50 p-4 text-sm font-bold dark:bg-slate-800">Format: {watch("invoicePrefix") || "INV"}-YYYY-XXXX</div><label className="block md:col-span-2"><span className="premium-label">Default notes</span><textarea className="premium-input mt-2 min-h-28 rounded-xl" {...register("defaultNotes")} /></label><label className="block md:col-span-2"><span className="premium-label">Default terms</span><textarea className="premium-input mt-2 min-h-28 rounded-xl" {...register("defaultTerms")} /></label></div>;
}

function PaymentTab({ register, watch }) {
  const upi = watch("upiId") || "";
  const qr = upi ? `upi://pay?pa=${upi}&pn=${encodeURIComponent(watch("companyName") || "InvoiceFlow")}` : "upi://pay";
  return <div className="grid gap-5 xl:grid-cols-[1fr_220px]"><div className="grid gap-4 md:grid-cols-2"><Input label="UPI ID" bind={register("upiId")} /><Input label="Account name" bind={register("bank.accountName")} /><Input label="Account number" bind={register("bank.accountNo")} /><Input label="IFSC" bind={register("bank.ifsc")} /><Input label="Bank name" bind={register("bank.bankName")} /><div className="grid grid-cols-2 gap-3 md:col-span-2"><Toggle label="UPI" bind={register("paymentMethods.UPI")} /><Toggle label="Cash" bind={register("paymentMethods.Cash")} /><Toggle label="Bank" bind={register("paymentMethods.Bank")} /><Toggle label="Card" bind={register("paymentMethods.Card")} /></div></div><div className="rounded-xl border border-slate-200 p-5 text-center dark:border-slate-800"><QRCodeSVG value={qr} size={160} includeMargin /><button type="button" className="secondary-btn mt-4 w-full rounded-xl" onClick={() => navigator.clipboard.writeText(upi).then(() => toast.success("UPI ID copied"))}><Copy className="h-4 w-4" /> Copy UPI</button></div></div>;
}

function TaxTab({ register, setValue, watch }) {
  return <div className="grid gap-4 md:grid-cols-2"><Toggle label="Enable tax on invoices" bind={register("taxEnabled")} /><CustomSelect label="Default GST rate" value={watch("taxRate")} onChange={(value) => setValue("taxRate", Number(value), { shouldValidate: true })} options={[0, 5, 12, 18, 28].map((value) => ({ label: `${value}%`, value }))} /><Input label="Tax display label" bind={register("taxLabel")} /></div>;
}

function EmailTab({ register }) {
  return <div className="grid gap-4 md:grid-cols-2"><Input label="SMTP host" bind={register("emailSettings.smtpHost")} /><Input label="SMTP port" type="number" bind={register("emailSettings.smtpPort")} /><Input label="SMTP user" bind={register("emailSettings.smtpUser")} /><Input label="SMTP password" type="password" bind={register("emailSettings.smtpPassword")} /><Input label="From name" bind={register("emailSettings.fromName")} /><Input label="From email" bind={register("emailSettings.fromEmail")} /><Input label="Subject template" bind={register("emailSettings.subjectTemplate")} /><label className="block md:col-span-2"><span className="premium-label">Body template</span><textarea className="premium-input mt-2 min-h-36 rounded-xl" {...register("emailSettings.bodyTemplate")} /></label><button type="button" className="secondary-btn rounded-xl md:col-span-2" onClick={() => toast.success("SMTP settings are ready to save")}>Test email</button></div>;
}

function NotificationsTab({ register }) {
  return <div className="grid gap-4 md:grid-cols-2"><Toggle label="Email on invoice sent" bind={register("notifications.invoiceSent")} /><Toggle label="Email on payment received" bind={register("notifications.paymentReceived")} /><Toggle label="Overdue invoice alerts" bind={register("notifications.overdueAlerts")} /><Input label="Alert days before due" type="number" bind={register("notifications.alertDaysBeforeDue")} /></div>;
}

function LogoDrop({ value, onChange }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ accept: { "image/*": [] }, multiple: false, onDrop: ([file]) => fileToBase64(file).then(onChange).catch(() => toast.error("Logo upload failed")) });
  return <div><p className="premium-label">Company logo</p><div {...getRootProps()} className={`mt-2 grid min-h-48 cursor-pointer place-items-center rounded-xl border border-dashed p-4 text-center ${isDragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"}`}><input {...getInputProps()} />{value ? <img className="max-h-32 rounded-lg object-contain" src={value} alt="Company logo" /> : <div><ImagePlus className="mx-auto h-8 w-8 text-blue-600" /><p className="mt-2 text-sm font-semibold text-slate-500">Drop or choose logo</p></div>}</div>{value && <button type="button" className="secondary-btn mt-3 w-full rounded-xl" onClick={() => onChange("")}>Remove</button>}</div>;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Input({ label, bind, error, type = "text" }) {
  return <label className="block"><span className="premium-label">{label}</span><input className="premium-input mt-2 rounded-xl" type={type} {...bind} />{error && <span className="mt-1 block text-xs font-semibold text-rose-500">{error}</span>}</label>;
}

function Toggle({ label, bind }) {
  return <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 text-sm font-bold dark:border-slate-800"><span>{label}</span><input type="checkbox" className="h-5 w-5 accent-blue-600" {...bind} /></label>;
}
