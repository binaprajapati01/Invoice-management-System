import express from "express";
import Invoice from "../models/Invoice.js";
import { requireAuth } from "../middleware/auth.js";
import { calculateInvoice } from "../utils/invoiceMath.js";
import { streamInvoicePdf } from "../utils/pdf.js";
import { logActivity } from "../utils/logActivity.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { invoiceScopeFor } from "../utils/scope.js";
import { createMailer } from "../config/mail.js";

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
    const invoiceNumber = payload.invoiceNumber || `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
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

router.delete("/:id", asyncHandler(async (req, res) => {
    const invoice = await Invoice.findOneAndUpdate({ _id: req.params.id, ...invoiceScopeFor(req.user), isDeleted: { $ne: true } }, { isDeleted: true, deletedAt: new Date() });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    await logActivity(req, "Deleted invoice", "Invoice", req.params.id);
    res.status(204).end();
}));

router.get("/:id/pdf", asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, ...invoiceScopeFor(req.user), isDeleted: { $ne: true } });
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  streamInvoicePdf(invoice, res);
}));

router.post("/:id/email", asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, ...invoiceScopeFor(req.user), isDeleted: { $ne: true } });
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  const mailer = createMailer();
  if (!mailer) return res.status(503).json({ message: "SMTP is not configured" });
  const to = req.body.to || invoice.clientSnapshot?.email;
  if (!to) return res.status(400).json({ message: "Recipient email is required" });
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `Invoice ${invoice.invoiceNumber}`,
    html: `<p>Hello ${invoice.clientSnapshot?.name || "there"},</p><p>Please find invoice <strong>${invoice.invoiceNumber}</strong> for ${invoice.currency} ${Number(invoice.total || 0).toFixed(2)}.</p><p>Due date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "On receipt"}.</p>`
  });
  await logActivity(req, "Emailed invoice", "Invoice", req.params.id, { to });
  res.json({ message: "Invoice email sent" });
}));

export default router;

function sanitizeInvoicePayload(body = {}) {
  const payload = { ...body };
  if (!payload.client || (typeof payload.client === "string" && !payload.client.trim())) {
    delete payload.client;
  }
  return payload;
}
