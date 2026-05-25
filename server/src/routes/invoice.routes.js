import express from "express";
import Invoice from "../models/Invoice.js";
import Settings from "../models/Settings.js";
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
    unpaid: invoices.filter((invoice) => ["Sent", "Pending"].includes(invoice.status)).length,
    overdue: invoices.filter((invoice) => invoice.status === "Overdue").length,
    draft: invoices.filter((invoice) => invoice.status === "Draft").length
  });
}));

router.post("/", asyncHandler(async (req, res) => {
    const payload = sanitizeInvoicePayload(req.body);
    const settings = await Settings.findOne({});
    const prefix = settings?.invoicePrefix || "INV";
    const year = new Date().getFullYear();
    const count = await Invoice.countDocuments({ invoiceNumber: new RegExp(`^${escapeRegex(prefix)}-${year}-`) });
    const invoiceNumber = payload.invoiceNumber || `${prefix}-${year}-${String(count + 1).padStart(5, "0")}`;
    const totals = calculateInvoice(payload.items);
    const invoice = await Invoice.create({ ...payload, ...totals, invoiceNumber, createdBy: req.user._id });
    await logActivity(req, "Created invoice", "Invoice", invoice._id, { invoiceNumber });
    res.status(201).json(invoice);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, ...invoiceScopeFor(req.user), isDeleted: { $ne: true } }).populate("client template createdBy", "name email company role");
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  res.json(invoice);
}));

router.patch("/:id", asyncHandler(async (req, res) => {
    const payload = sanitizeInvoicePayload(req.body);
    const totals = payload.items ? calculateInvoice(payload.items) : {};
    const invoice = await Invoice.findOneAndUpdate({ _id: req.params.id, ...invoiceScopeFor(req.user), isDeleted: { $ne: true } }, { ...payload, ...totals }, { new: true });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    await logActivity(req, "Updated invoice", "Invoice", req.params.id);
    res.json(invoice);
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

  const to = invoice.client?.email || invoice.clientSnapshot?.email;
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
    await invoice.save();
  }

  await logActivity(req, "Sent invoice via email", "Invoice", req.params.id, { to, invoiceNumber: invoice.invoiceNumber });
  res.json({ success: true, message: "Email sent" });
}

export default router;

function sanitizeInvoicePayload(body = {}) {
  const payload = { ...body };
  if (!payload.client || (typeof payload.client === "string" && !payload.client.trim())) {
    delete payload.client;
  }
  return payload;
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
