import express from "express";
import { z } from "zod";
import Invoice from "../models/Invoice.js";
import Client from "../models/Client.js";
import Settings from "../models/Settings.js";
import Counter from "../models/Counter.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { calculateInvoice } from "../utils/invoiceMath.js";
import { buildInvoicePdfBuffer, streamInvoicePdf } from "../utils/pdf.js";
import { logActivity } from "../utils/logActivity.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { invoiceScopeFor } from "../utils/scope.js";
import { createMailer, getFromAddress } from "../config/mail.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const query = { ...invoiceScopeFor(req.user), isDeleted: { $ne: true } };
  if (req.query.q) {
    const q = new RegExp(req.query.q, "i");
    query.$or = [{ invoiceNumber: q }, { "clientSnapshot.name": q }, { "clientSnapshot.email": q }];
  }
  if (req.query.status && req.query.status !== "All") query.status = req.query.status;
  const invoices = await Invoice.find(query).populate("client", "name email company").populate("createdBy", "name role").sort({ createdAt: -1 });
  res.json(invoices);
}));

router.get("/stats", asyncHandler(async (req, res) => {
  const query = { ...invoiceScopeFor(req.user), isDeleted: { $ne: true } };
  const invoices = await Invoice.find(query);
  res.json({
    totalInvoices: invoices.length,
    totalRevenue: invoices.filter((invoice) => invoice.status === "Paid").reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
    paid: invoices.filter((invoice) => invoice.status === "Paid").length,
    unpaid: invoices.filter((invoice) => invoice.status === "Sent").length,
    overdue: invoices.filter((invoice) => invoice.status === "Overdue").length,
    draft: invoices.filter((invoice) => invoice.status === "Draft").length
  });
}));

router.get("/next-number", asyncHandler(async (_req, res) => {
  const settings = await Settings.findOne({});
  const prefix = normalizePrefix(settings?.invoicePrefix || "INV");
  const year = new Date().getFullYear();
  const count = await Invoice.countDocuments({ invoiceNumber: new RegExp(`^${escapeRegex(prefix)}-${year}-`) });
  res.json({ invoiceNumber: formatInvoiceNumber(prefix, year, count + 1) });
}));

router.post("/", asyncHandler(async (req, res) => {
    const payload = await buildInvoicePayload(req);
    const settings = await Settings.findOne({});
    const prefix = normalizePrefix(settings?.invoicePrefix || "INV");
    const year = new Date().getFullYear();
    const invoiceNumber = payload.invoiceNumber || await generateInvoiceNumber(prefix, year);
    const totals = calculateInvoice(payload.items);
    const invoice = await Invoice.create({
      ...payload,
      ...totals,
      invoiceNumber,
      paymentStatus: paymentStatusFor(Number(payload.paidAmount || 0), totals.total),
      createdBy: req.user._id,
      history: [{ action: "Created", status: payload.status || "Draft", by: req.user._id, at: new Date() }]
    });
    await logActivity(req, "Created invoice", "Invoice", invoice._id, { invoiceNumber });
    res.status(201).json(invoice);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, ...invoiceScopeFor(req.user), isDeleted: { $ne: true } }).populate("client template createdBy", "name email company role");
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  res.json(invoice);
}));

router.patch("/:id", asyncHandler(async (req, res) => {
    const payload = await buildInvoicePayload(req, true);
    const totals = payload.items ? calculateInvoice(payload.items) : {};
    const update = { ...payload, ...totals };
    if (payload.paidAmount !== undefined || totals.total !== undefined) {
      update.paymentStatus = paymentStatusFor(Number(payload.paidAmount || 0), Number(totals.total || payload.total || 0));
    }
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, ...invoiceScopeFor(req.user), isDeleted: { $ne: true } },
      { $set: update, $push: { history: { action: "Updated", status: update.status, by: req.user._id, at: new Date() } } },
      { new: true }
    );
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    await logActivity(req, "Updated invoice", "Invoice", req.params.id);
    res.json(invoice);
}));

router.post("/:id/duplicate", asyncHandler(async (req, res) => {
  const original = await Invoice.findOne({ _id: req.params.id, ...invoiceScopeFor(req.user), isDeleted: { $ne: true } }).lean();
  if (!original) return res.status(404).json({ message: "Invoice not found" });
  const settings = await Settings.findOne({});
  const prefix = normalizePrefix(settings?.invoicePrefix || "INV");
  const year = new Date().getFullYear();
  const invoiceNumber = await generateInvoiceNumber(prefix, year);
  const { _id, createdAt, updatedAt, __v, history, ...copy } = original;
  const duplicate = await Invoice.create({
    ...copy,
    invoiceNumber,
    status: "Draft",
    paidAmount: 0,
    paymentStatus: "Unpaid",
    issueDate: new Date(),
    createdBy: req.user._id,
    history: [{ action: "Duplicated", status: "Draft", note: `Copied from ${original.invoiceNumber}`, by: req.user._id, at: new Date() }]
  });
  await logActivity(req, "Duplicated invoice", "Invoice", duplicate._id, { from: original.invoiceNumber, invoiceNumber });
  res.status(201).json(duplicate);
}));

router.get("/:id/history", asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, ...invoiceScopeFor(req.user), isDeleted: { $ne: true } })
    .populate("history.by", "name email role")
    .select("invoiceNumber history createdAt updatedAt status");
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  res.json(invoice.history || []);
}));

router.delete("/:id", requireRole("Super Admin", "Admin", "Manager"), asyncHandler(async (req, res) => {
    const invoice = await Invoice.findOneAndUpdate({ _id: req.params.id, ...invoiceScopeFor(req.user), isDeleted: { $ne: true } }, { isDeleted: true, deletedAt: new Date() });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    await logActivity(req, "Deleted invoice", "Invoice", req.params.id);
    res.status(204).end();
}));

router.get("/:id/pdf", asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, ...invoiceScopeFor(req.user), isDeleted: { $ne: true } }).populate("template");
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });

  const tmpl = invoice.template;
  if (tmpl?.templateType === "html" && tmpl?.htmlContent) {
    const { renderTemplate } = await import("../utils/templateRenderer.js");
    const html = renderTemplate(tmpl.htmlContent, invoice);
    let browser;
    try {
      const puppeteer = await import("puppeteer");
      browser = await puppeteer.default.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=${invoice.invoiceNumber}.pdf`);
      return res.send(pdfBuffer);
    } catch (error) {
      console.warn("HTML template PDF generation failed, falling back to PDFKit:", error.message);
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  streamInvoicePdf(invoice, res);
}));

router.post("/:id/send-email", asyncHandler(sendInvoiceEmail));
router.post("/:id/email", asyncHandler(sendInvoiceEmail));

async function sendInvoiceEmail(req, res) {
  const invoice = await Invoice.findOne({ _id: req.params.id, ...invoiceScopeFor(req.user), isDeleted: { $ne: true } }).populate("client", "name email");
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });

  const settings = await Settings.findOne({});
  const mailer = createMailer(settings);
  if (!mailer) return res.status(503).json({ message: "SMTP is not configured" });

  const { to: requestedTo } = z.object({ to: z.string().email().optional() }).partial().parse(req.body || {});
  const to = requestedTo || invoice.client?.email || invoice.clientSnapshot?.email;
  if (!to) return res.status(400).json({ message: "Client email is required" });

  const placeholders = buildEmailPlaceholders(invoice);
  const subject = replaceTemplate(settings?.emailSettings?.subjectTemplate || "Invoice {{invoiceNumber}}", placeholders);
  const html = replaceTemplate(settings?.emailSettings?.bodyTemplate || defaultInvoiceEmailTemplate(), placeholders);
  const pdfBuffer = await buildInvoicePdfBuffer(invoice);

  await mailer.sendMail({
    from: getFromAddress(settings),
    to,
    subject,
    html,
    attachments: [{
      filename: `${invoice.invoiceNumber}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf"
    }]
  });

  if (invoice.status === "Draft") {
    invoice.status = "Sent";
    invoice.history.push({ action: "Sent by email", status: "Sent", by: req.user._id, at: new Date() });
    await invoice.save();
  }

  await logActivity(req, "Sent invoice via email", "Invoice", req.params.id, { to, invoiceNumber: invoice.invoiceNumber });
  res.json({ success: true, message: "Email sent" });
}

export default router;

const itemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required"),
  description: z.string().optional().default(""),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  price: z.coerce.number().min(0, "Unit price cannot be negative"),
  tax: z.coerce.number().min(0).max(100).default(0),
  discount: z.coerce.number().min(0).max(100).default(0)
});

const invoicePayloadSchema = z.object({
  invoiceNumber: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["Draft", "Sent", "Paid", "Overdue", "Cancelled"]).default("Draft"),
  currency: z.string().trim().min(2).max(6).default("INR"),
  client: z.string().optional().or(z.literal("")),
  clientSnapshot: z.object({
    name: z.string().trim().min(2, "Client name is required"),
    email: z.string().trim().email("Client email is invalid"),
    address: z.string().optional().default(""),
    billingAddress: z.string().optional().default(""),
    shippingAddress: z.string().optional().default(""),
    taxId: z.string().optional().default("")
  }),
  company: z.object({
    name: z.string().optional().default(""),
    email: z.string().optional().default(""),
    address: z.string().optional().default(""),
    logo: z.string().optional().default(""),
    signature: z.string().optional().default("")
  }).optional().default({}),
  items: z.array(itemSchema).min(1, "At least one invoice item is required"),
  paidAmount: z.coerce.number().min(0).optional().default(0),
  dueDate: z.coerce.date().optional(),
  issueDate: z.coerce.date().optional(),
  paymentTerms: z.string().optional().default(""),
  paymentMethod: z.enum(["Card", "Bank Transfer", "UPI", "Cash", "Other", ""]).optional().default(""),
  notes: z.string().optional().default(""),
  terms: z.string().optional().default(""),
  bank: z.object({
    accountNo: z.string().optional().default(""),
    ifsc: z.string().optional().default(""),
    bankName: z.string().optional().default(""),
    accountName: z.string().optional().default("")
  }).optional().default({}),
  qrPaymentUrl: z.string().optional().default(""),
  watermark: z.string().optional().default(""),
  template: z.string().optional().or(z.literal(""))
});

async function buildInvoicePayload(req, partial = false) {
  const schema = partial ? invoicePayloadSchema.partial() : invoicePayloadSchema;
  const payload = schema.parse(req.body);
  if (payload.client) {
    const client = await Client.findOne({ _id: payload.client, ...(normalizeRole(req.user.role) === "manager" ? { createdBy: req.user._id } : {}) });
    if (!client) {
      const error = new Error("Selected client is unavailable");
      error.status = 400;
      throw error;
    }
  }
  if (!payload.client || (typeof payload.client === "string" && !payload.client.trim())) {
    delete payload.client;
  }
  if (!payload.invoiceNumber) delete payload.invoiceNumber;
  if (!payload.template) delete payload.template;
  return payload;
}

async function generateInvoiceNumber(prefix, year) {
  const counter = await Counter.findOneAndUpdate(
    { key: `invoice:${prefix}:${year}` },
    { $inc: { value: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return formatInvoiceNumber(prefix, year, counter.value);
}

function formatInvoiceNumber(prefix, year, sequence) {
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
}

function normalizePrefix(prefix) {
  return String(prefix || "INV").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "") || "INV";
}

function normalizeRole(role = "") {
  return String(role).trim().toLowerCase().replace(/\s+/g, " ");
}

function paymentStatusFor(paidAmount, total) {
  if (paidAmount <= 0) return "Unpaid";
  if (paidAmount >= total) return "Paid";
  return "Partial";
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildEmailPlaceholders(invoice) {
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "On receipt";
  return {
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.client?.name || invoice.clientSnapshot?.name || "Client",
    total: `${invoice.currency || "INR"} ${Number(invoice.total || 0).toFixed(2)}`,
    dueDate
  };
}

function replaceTemplate(template, values) {
  return String(template || "").replace(/{{\s*(invoiceNumber|clientName|total|dueDate)\s*}}/g, (_match, key) => values[key] || "");
}

function defaultInvoiceEmailTemplate() {
  return [
    "<p>Hello {{clientName}},</p>",
    "<p>Please find attached invoice <strong>{{invoiceNumber}}</strong> for <strong>{{total}}</strong>.</p>",
    "<p>Due date: <strong>{{dueDate}}</strong>.</p>"
  ].join("");
}
