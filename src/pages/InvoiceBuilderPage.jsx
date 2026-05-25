import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Document, Image, Page, PDFDownloadLink, StyleSheet, Text, View } from "@react-pdf/renderer";
import { useDropzone } from "react-dropzone";
import SignatureCanvas from "react-signature-canvas";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Download, ImagePlus, Mail, Plus, Printer, Save, Send, Trash2, UsersRound, X } from "lucide-react";
import toast from "react-hot-toast";
import { calculateInvoice, formatMoney } from "../lib/invoice.js";
import { CustomSelect, PageHeader } from "../components/ui.jsx";
import { useAppStore } from "../store/appStore.js";
import CrudModal from "../components/CrudModal.jsx";

const currencies = ["INR", "USD", "EUR", "GBP", "AED"];
const statuses = ["Draft", "Sent", "Pending", "Paid", "Overdue"];
const emptyItem = { name: "", description: "", quantity: 1, price: 0, tax: 0, discount: 0 };

export default function InvoiceBuilderPage() {
  const signatureRef = useRef(null);
  const qrCanvasRef = useRef(null);
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients, settings, loading, fetchClients, fetchSettings, fetchInvoice, saveInvoice, saveClient, emailInvoice } = useAppStore();
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "", address: "", GSTIN: "", panNumber: "", status: "Active", currency: "INR" });
  const [invoice, setInvoice] = useState(() => buildInitialInvoice());
  const totals = useMemo(() => calculateInvoice(invoice.items), [invoice.items]);
  const invoiceWithTotals = useMemo(() => ({ ...invoice, ...totals }), [invoice, totals]);
  const qrValue = useMemo(() => {
    const upi = settings?.upiId || "";
    const amount = Number(totals.total || 0).toFixed(2);
    return JSON.stringify({ invoice: invoice.invoiceNumber, amount, client: invoice.clientSnapshot?.name || "", upi });
  }, [invoice.invoiceNumber, invoice.clientSnapshot?.name, settings?.upiId, totals.total]);

  useEffect(() => {
    Promise.all([fetchClients(), fetchSettings()]).catch((error) => toast.error(error.message));
  }, []);

  useEffect(() => {
    if (!settings || id) return;
    const due = new Date();
    due.setDate(due.getDate() + Number(settings.defaultDueDays || 15));
    setInvoice((current) => ({
      ...current,
      invoiceNumber: current.invoiceNumber || generateInvoiceNumber(settings.invoicePrefix || "INV"),
      currency: settings.defaultCurrency || settings.currency || "INR",
      dueDate: due.toISOString().slice(0, 10),
      company: {
        name: settings.companyName || "",
        email: settings.companyEmail || "",
        address: settings.companyAddress || "",
        logo: settings.logo || "",
        signature: ""
      },
      notes: settings.defaultNotes || "",
      terms: settings.defaultTerms || "",
      bank: { accountName: "", accountNo: "", ifsc: "", bankName: "", ...settings.bank }
    }));
  }, [settings, id]);

  useEffect(() => {
    if (!id) return;
    fetchInvoice(id).then((data) => {
      setInvoice({
        ...buildInitialInvoice(),
        ...data,
        client: data.client?._id || data.client || "",
        issueDate: toDateInput(data.issueDate),
        dueDate: toDateInput(data.dueDate),
        company: { name: "", email: "", address: "", logo: "", signature: "", ...data.company },
        clientSnapshot: { name: "", email: "", address: "", taxId: "", ...data.clientSnapshot },
        bank: { accountName: "", accountNo: "", ifsc: "", bankName: "", ...data.bank },
        items: data.items?.length ? data.items : [{ ...emptyItem }]
      });
      setEmailTo(data.clientSnapshot?.email || "");
    }).catch((error) => toast.error(error.message));
  }, [id]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (qrCanvasRef.current) setQrDataUrl(qrCanvasRef.current.toDataURL("image/png"));
    }, 80);
    return () => window.clearTimeout(handle);
  }, [qrValue]);

  const setField = (path, value) => {
    setInvoice((current) => {
      const next = structuredClone(current);
      const parts = path.split(".");
      let target = next;
      parts.slice(0, -1).forEach((part) => { target = target[part]; });
      target[parts.at(-1)] = value;
      return next;
    });
  };

  const selectClient = (clientOrId) => {
    const client = typeof clientOrId === "object" ? clientOrId : clients.find((item) => item._id === clientOrId);
    if (!client) return;
    setInvoice((current) => ({
      ...current,
      client: client._id,
      currency: client.currency || current.currency,
      clientSnapshot: {
        name: client.company || client.name,
        email: client.email,
        address: [client.address, client.city, client.state, client.country, client.pincode].filter(Boolean).join(", "),
        taxId: client.GSTIN || client.taxId || client.panNumber || ""
      }
    }));
    setEmailTo(client.email || "");
  };

  const addClientInline = async () => {
    try {
      const saved = await saveClient(newClient);
      selectClient(saved);
      setNewClient({ name: "", email: "", phone: "", address: "", GSTIN: "", panNumber: "", status: "Active", currency: invoice.currency });
      toast.success("Client added");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const updateItem = (index, key, value) => {
    setInvoice((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: ["quantity", "price", "tax", "discount"].includes(key) ? Number(value) : value } : item)
    }));
  };

  const addItem = () => setInvoice((current) => ({ ...current, items: [...current.items, { ...emptyItem }] }));
  const removeItem = (index) => setInvoice((current) => ({ ...current, items: current.items.length > 1 ? current.items.filter((_item, itemIndex) => itemIndex !== index) : current.items }));

  const persistInvoice = async (status = invoice.status) => {
    if (!invoice.clientSnapshot?.name || !invoice.clientSnapshot?.email) {
      toast.error("Add client billing details before saving");
      return null;
    }
    if (!invoice.items.some((item) => item.name && Number(item.quantity) > 0)) {
      toast.error("Add at least one invoice item");
      return null;
    }
    try {
      const selectedClientId = clients.some((client) => client._id === invoice.client) ? invoice.client : "";
      const saved = await saveInvoice({ ...invoiceWithTotals, client: selectedClientId, status, qrPaymentUrl: qrValue }, id);
      toast.success(status === "Draft" ? "Draft saved" : "Invoice saved");
      if (!id) navigate(`/invoices/${saved._id}/edit`, { replace: true });
      return saved;
    } catch (error) {
      toast.error(error.message);
      return null;
    }
  };

  const sendEmail = async () => {
    const saved = id ? { _id: id } : await persistInvoice("Sent");
    if (!saved) return;
    try {
      await emailInvoice(saved._id, emailTo || invoice.clientSnapshot?.email);
      toast.success("Invoice email sent");
      setEmailOpen(false);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handlePrint = async () => {
    const saved = await persistInvoice(invoice.status);
    if (!saved?._id) return;
    try {
      const token = localStorage.getItem("invoiceflow_token") || localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`/api/invoices/${saved._id}/pdf`, {
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
        eyebrow="Invoice builder"
        title={id ? "Edit Invoice" : "Create Invoice"}
        description="Create a real invoice with live totals, client data, logo, signature, payment QR, PDF export, email sending, and print styling."
        action={<div className="flex flex-wrap gap-2"><button className="secondary-btn rounded-xl" onClick={() => persistInvoice("Draft")} disabled={loading.invoiceSave}><Save className="h-4 w-4" /> Save draft</button><button className="premium-btn rounded-xl" onClick={() => persistInvoice(invoice.status === "Draft" ? "Sent" : invoice.status)} disabled={loading.invoiceSave}>Save invoice</button></div>}
      />
      <QRCodeCanvas ref={qrCanvasRef} value={qrValue} size={192} className="hidden" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,60%)_minmax(380px,40%)]">
        <section className="space-y-5">
          <Panel title="Header">
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <DropAsset label="Company logo" value={invoice.company.logo} onChange={(value) => setField("company.logo", value)} />
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Invoice number" value={invoice.invoiceNumber} onChange={(value) => setField("invoiceNumber", value)} />
                <CustomSelect label="Currency" value={invoice.currency} onChange={(value) => setField("currency", value)} options={currencies} />
                <Input label="Invoice date" type="date" value={invoice.issueDate} onChange={(value) => setField("issueDate", value)} />
                <Input label="Due date" type="date" value={invoice.dueDate} onChange={(value) => setField("dueDate", value)} />
                <CustomSelect label="Status" value={invoice.status} onChange={(value) => setField("status", value)} options={statuses} />
              </div>
            </div>
          </Panel>

          <Panel title="Bill to">
            <div className="grid gap-4 lg:grid-cols-2">
              <CustomSelect label="Client" value={invoice.client || ""} onChange={selectClient} options={clients.map((client) => ({ label: client.company || client.name, value: client._id, icon: UsersRound }))} placeholder="Choose client" />
              <Input label="Client email" value={invoice.clientSnapshot.email} onChange={(value) => setField("clientSnapshot.email", value)} />
              <Input label="Client name" value={invoice.clientSnapshot.name} onChange={(value) => setField("clientSnapshot.name", value)} />
              <Input label="GST / Tax number" value={invoice.clientSnapshot.taxId} onChange={(value) => setField("clientSnapshot.taxId", value)} />
              <TextArea label="Client address" value={invoice.clientSnapshot.address} onChange={(value) => setField("clientSnapshot.address", value)} />
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="premium-label">Add new client</p>
                <div className="mt-3 grid gap-3">
                  <input className="premium-input rounded-xl" value={newClient.name} onChange={(event) => setNewClient((client) => ({ ...client, name: event.target.value }))} aria-label="New client name" />
                  <input className="premium-input rounded-xl" value={newClient.email} onChange={(event) => setNewClient((client) => ({ ...client, email: event.target.value }))} aria-label="New client email" />
                  <button className="secondary-btn rounded-xl" type="button" onClick={addClientInline} disabled={!newClient.name || !newClient.email}>Add client</button>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Items" action={<button className="secondary-btn rounded-xl" onClick={addItem}><Plus className="h-4 w-4" /> Add item</button>}>
            <div className="space-y-3">
              {invoice.items.map((item, index) => {
                const line = calculateInvoice([item]);
                return (
                  <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="grid gap-3 xl:grid-cols-[1.4fr_0.45fr_0.65fr_0.55fr_0.65fr_0.75fr_44px]">
                      <Input label="Description" value={item.name} onChange={(value) => updateItem(index, "name", value)} />
                      <Input label="Qty" type="number" value={item.quantity} onChange={(value) => updateItem(index, "quantity", value)} />
                      <Input label="Unit price" type="number" value={item.price} onChange={(value) => updateItem(index, "price", value)} />
                      <Input label="Tax %" type="number" value={item.tax} onChange={(value) => updateItem(index, "tax", value)} />
                      <Input label="Discount %" type="number" value={item.discount} onChange={(value) => updateItem(index, "discount", value)} />
                      <div><p className="premium-label">Amount</p><p className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-sm font-black dark:bg-slate-800">{formatMoney(line.total, invoice.currency)}</p></div>
                      <button className="mt-7 grid h-11 w-11 place-items-center rounded-xl text-rose-500 hover:bg-rose-50" onClick={() => removeItem(index)}><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="mt-3"><TextArea label="Line details" value={item.description} onChange={(value) => updateItem(index, "description", value)} /></div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Totals and additional details">
            <div className="grid gap-4 lg:grid-cols-2">
              <TextArea label="Notes" value={invoice.notes} onChange={(value) => setField("notes", value)} />
              <TextArea label="Terms and conditions" value={invoice.terms} onChange={(value) => setField("terms", value)} />
              <Input label="Bank name" value={invoice.bank.bankName} onChange={(value) => setField("bank.bankName", value)} />
              <Input label="Account number" value={invoice.bank.accountNo} onChange={(value) => setField("bank.accountNo", value)} />
              <Input label="IFSC / Swift" value={invoice.bank.ifsc} onChange={(value) => setField("bank.ifsc", value)} />
              <Input label="Account name" value={invoice.bank.accountName} onChange={(value) => setField("bank.accountName", value)} />
              <div className="lg:col-span-2">
                <p className="premium-label">Signature</p>
                <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800">
                  <SignatureCanvas ref={signatureRef} canvasProps={{ className: "h-32 w-full rounded-lg bg-white" }} onEnd={() => setField("company.signature", signatureRef.current?.toDataURL("image/png") || "")} />
                  <div className="mt-3 flex gap-2">
                    <DropAsset compact label="Upload signature" value={invoice.company.signature} onChange={(value) => setField("company.signature", value)} />
                    <button type="button" className="secondary-btn rounded-xl" onClick={() => { signatureRef.current?.clear(); setField("company.signature", ""); }}>Clear</button>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </section>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <InvoicePreview invoice={invoiceWithTotals} qrValue={qrValue} />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <PDFDownloadLink className="secondary-btn rounded-xl" document={<InvoicePdf invoice={invoiceWithTotals} qrDataUrl={qrDataUrl} />} fileName={`${invoice.invoiceNumber || "invoice"}.pdf`}>
              {({ loading: pdfLoading }) => <><Download className="h-4 w-4" /> {pdfLoading ? "Preparing" : "PDF"}</>}
            </PDFDownloadLink>
            <button className="secondary-btn rounded-xl" onClick={handlePrint}><Printer className="h-4 w-4" /> Print</button>
            <button className="premium-btn rounded-xl" onClick={() => setEmailOpen(true)}><Mail className="h-4 w-4" /> Email</button>
          </div>
        </aside>
      </div>

      <CrudModal open={emailOpen} title="Send invoice" onClose={() => setEmailOpen(false)}>
        <div className="space-y-4">
          <Input label="Recipient email" value={emailTo} onChange={setEmailTo} />
          <div className="flex justify-end gap-3"><button className="secondary-btn rounded-xl" onClick={() => setEmailOpen(false)}>Cancel</button><button className="premium-btn rounded-xl" onClick={sendEmail}><Send className="h-4 w-4" /> Send</button></div>
        </div>
      </CrudModal>
    </>
  );
}

function buildInitialInvoice() {
  return {
    invoiceNumber: generateInvoiceNumber("INV"),
    currency: "INR",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    status: "Draft",
    company: { name: "", email: "", address: "", logo: "", signature: "" },
    client: "",
    clientSnapshot: { name: "", email: "", address: "", taxId: "" },
    items: [{ ...emptyItem }],
    notes: "",
    terms: "",
    bank: { accountName: "", accountNo: "", ifsc: "", bankName: "" },
    qrPaymentUrl: ""
  };
}

function generateInvoiceNumber(prefix) {
  return `${prefix}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

function toDateInput(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function Panel({ title, action, children }) {
  return <section className="premium-card rounded-xl"><div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-lg font-bold">{title}</h2>{action}</div>{children}</section>;
}

function Input({ label, value, onChange, type = "text" }) {
  return <label className="block"><span className="premium-label">{label}</span><input className="premium-input mt-2 rounded-xl" type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextArea({ label, value, onChange }) {
  return <label className="block"><span className="premium-label">{label}</span><textarea className="premium-input mt-2 min-h-24 resize-y rounded-xl" value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></label>;
}

function DropAsset({ label, value, onChange, compact = false }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [] },
    multiple: false,
    onDrop: ([file]) => file && fileToBase64(file).then(onChange).catch(() => toast.error("Image upload failed"))
  });
  if (compact) {
    return <button type="button" className="secondary-btn rounded-xl" {...getRootProps()}><input {...getInputProps()} /><ImagePlus className="h-4 w-4" /> {label}</button>;
  }
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <p className="premium-label">{label}</p>
      <div {...getRootProps()} className={`mt-3 grid min-h-40 cursor-pointer place-items-center rounded-xl border border-dashed p-4 text-center transition ${isDragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"}`}>
        <input {...getInputProps()} />
        {value ? <img className="max-h-28 rounded-lg object-contain" src={value} alt={label} /> : <div><ImagePlus className="mx-auto h-8 w-8 text-blue-600" /><p className="mt-2 text-sm font-semibold text-slate-500">Drop or choose image</p></div>}
      </div>
      {value && <button type="button" className="secondary-btn mt-3 w-full rounded-xl" onClick={() => onChange("")}><X className="h-4 w-4" /> Remove</button>}
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function InvoicePreview({ invoice, qrValue }) {
  return (
    <div className="invoice-preview rounded-xl bg-white p-8 text-slate-950 shadow-soft">
      <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-8">
        <div>{invoice.company.logo ? <img className="h-14 max-w-32 rounded-lg object-contain" src={invoice.company.logo} alt="Company logo" /> : <div className="grid h-14 w-14 place-items-center rounded-lg bg-slate-100 text-sm font-black text-slate-500">Logo</div>}<h2 className="mt-4 text-xl font-black">{invoice.company.name}</h2><p className="mt-1 text-sm text-slate-500">{invoice.company.email}</p><p className="mt-1 max-w-56 text-sm text-slate-500">{invoice.company.address}</p></div>
        <div className="text-right"><p className="text-4xl font-black text-blue-600">INVOICE</p><p className="mt-2 font-bold">{invoice.invoiceNumber}</p><span className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{invoice.status}</span></div>
      </div>
      <div className="grid gap-5 py-8 sm:grid-cols-2">
        <div><p className="premium-label">Bill to</p><h3 className="mt-2 text-lg font-black">{invoice.clientSnapshot.name}</h3><p className="text-sm text-slate-500">{invoice.clientSnapshot.email}</p><p className="mt-2 text-sm text-slate-500">{invoice.clientSnapshot.address}</p><p className="mt-1 text-sm text-slate-500">{invoice.clientSnapshot.taxId}</p></div>
        <div className="rounded-xl bg-slate-50 p-4 text-sm"><Row label="Issue date" value={invoice.issueDate} /><Row label="Due date" value={invoice.dueDate} /><Row label="Currency" value={invoice.currency} /></div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="grid grid-cols-[1.4fr_0.35fr_0.55fr_0.55fr_0.65fr] bg-slate-950 px-4 py-3 text-xs font-bold uppercase tracking-wide text-white"><span>Description</span><span>Qty</span><span>Rate</span><span>Tax</span><span className="text-right">Amount</span></div>
        {invoice.items.map((item, index) => <div key={index} className="grid grid-cols-[1.4fr_0.35fr_0.55fr_0.55fr_0.65fr] border-t border-slate-100 px-4 py-4 text-sm"><div><b>{item.name}</b><p className="mt-1 text-xs text-slate-500">{item.description}</p></div><span>{item.quantity}</span><span>{formatMoney(item.price, invoice.currency)}</span><span>{item.tax}%</span><b className="text-right">{formatMoney(calculateInvoice([item]).total, invoice.currency)}</b></div>)}
      </div>
      <div className="mt-6 flex justify-end"><div className="w-full max-w-xs space-y-3 text-sm"><Row label="Subtotal" value={formatMoney(invoice.subtotal, invoice.currency)} /><Row label="Discount" value={`-${formatMoney(invoice.discountTotal, invoice.currency)}`} /><Row label="Tax" value={formatMoney(invoice.taxTotal, invoice.currency)} /><div className="rounded-xl bg-blue-600 p-4 text-white"><Row label="Grand total" value={formatMoney(invoice.total, invoice.currency)} big /></div></div></div>
      <div className="mt-8 flex items-end justify-between gap-5"><div className="max-w-sm text-sm leading-6 text-slate-500"><p>{invoice.notes}</p><p className="mt-3">{invoice.terms}</p></div><QRCodeSVG value={qrValue} size={112} includeMargin /></div>
      <div className="mt-6 flex items-end justify-between"><p className="text-xs text-slate-500">{invoice.bank.bankName} {invoice.bank.accountNo}</p>{invoice.company.signature && <img className="h-16 max-w-40 object-contain" src={invoice.company.signature} alt="Signature" />}</div>
    </div>
  );
}

function Row({ label, value, big }) {
  return <div className={`flex justify-between gap-4 ${big ? "text-lg font-black" : ""}`}><span>{label}</span><span>{value}</span></div>;
}

const pdfStyles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: "#1F2937", fontFamily: "Helvetica" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  header: { borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingBottom: 22 },
  title: { fontSize: 30, color: "#2563EB", fontWeight: 700 },
  h2: { fontSize: 15, fontWeight: 700, marginTop: 10 },
  muted: { color: "#6B7280", marginTop: 4 },
  logo: { width: 72, maxHeight: 52, objectFit: "contain" },
  tableHead: { flexDirection: "row", backgroundColor: "#111827", color: "#FFFFFF", padding: 8, marginTop: 24 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E5E7EB", padding: 8 },
  c1: { width: "44%" }, c2: { width: "12%" }, c3: { width: "16%" }, c4: { width: "12%" }, c5: { width: "16%", textAlign: "right" },
  totalBox: { marginTop: 18, marginLeft: "auto", width: 210 },
  grand: { backgroundColor: "#2563EB", color: "#FFFFFF", padding: 10, marginTop: 8 },
  qr: { width: 92, height: 92 },
  signature: { width: 130, maxHeight: 58, objectFit: "contain" }
});

function InvoicePdf({ invoice, qrDataUrl }) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={[pdfStyles.row, pdfStyles.header]}>
          <View>{invoice.company.logo ? <Image src={invoice.company.logo} style={pdfStyles.logo} /> : null}<Text style={pdfStyles.h2}>{invoice.company.name}</Text><Text style={pdfStyles.muted}>{invoice.company.email}</Text><Text style={pdfStyles.muted}>{invoice.company.address}</Text></View>
          <View><Text style={pdfStyles.title}>INVOICE</Text><Text>{invoice.invoiceNumber}</Text><Text style={pdfStyles.muted}>{invoice.status}</Text></View>
        </View>
        <View style={[pdfStyles.row, { marginTop: 24 }]}><View><Text style={pdfStyles.h2}>Bill To</Text><Text style={pdfStyles.muted}>{invoice.clientSnapshot.name}</Text><Text style={pdfStyles.muted}>{invoice.clientSnapshot.email}</Text><Text style={pdfStyles.muted}>{invoice.clientSnapshot.address}</Text><Text style={pdfStyles.muted}>{invoice.clientSnapshot.taxId}</Text></View><View><Text>Issued: {invoice.issueDate}</Text><Text>Due: {invoice.dueDate}</Text><Text>Currency: {invoice.currency}</Text></View></View>
        <View style={pdfStyles.tableHead}><Text style={pdfStyles.c1}>Description</Text><Text style={pdfStyles.c2}>Qty</Text><Text style={pdfStyles.c3}>Rate</Text><Text style={pdfStyles.c4}>Tax</Text><Text style={pdfStyles.c5}>Amount</Text></View>
        {invoice.items.map((item, index) => <View key={index} style={pdfStyles.tableRow}><Text style={pdfStyles.c1}>{item.name}{"\n"}{item.description}</Text><Text style={pdfStyles.c2}>{item.quantity}</Text><Text style={pdfStyles.c3}>{formatMoney(item.price, invoice.currency)}</Text><Text style={pdfStyles.c4}>{item.tax}%</Text><Text style={pdfStyles.c5}>{formatMoney(calculateInvoice([item]).total, invoice.currency)}</Text></View>)}
        <View style={pdfStyles.totalBox}><PdfRow label="Subtotal" value={formatMoney(invoice.subtotal, invoice.currency)} /><PdfRow label="Discount" value={`-${formatMoney(invoice.discountTotal, invoice.currency)}`} /><PdfRow label="Tax" value={formatMoney(invoice.taxTotal, invoice.currency)} /><View style={pdfStyles.grand}><PdfRow label="Grand Total" value={formatMoney(invoice.total, invoice.currency)} /></View></View>
        <View style={[pdfStyles.row, { marginTop: 28, alignItems: "flex-end" }]}><View style={{ width: 330 }}><Text style={pdfStyles.muted}>{invoice.notes}</Text><Text style={pdfStyles.muted}>{invoice.terms}</Text></View>{qrDataUrl ? <Image src={qrDataUrl} style={pdfStyles.qr} /> : null}</View>
        <View style={[pdfStyles.row, { marginTop: 22, alignItems: "flex-end" }]}><Text style={pdfStyles.muted}>{invoice.bank.bankName} {invoice.bank.accountNo} {invoice.bank.ifsc}</Text>{invoice.company.signature ? <Image src={invoice.company.signature} style={pdfStyles.signature} /> : null}</View>
      </Page>
    </Document>
  );
}

function PdfRow({ label, value }) {
  return <View style={[pdfStyles.row, { marginTop: 5 }]}><Text>{label}</Text><Text>{value}</Text></View>;
}
