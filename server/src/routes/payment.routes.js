import express from "express";
import Payment from "../models/Payment.js";
import Invoice from "../models/Invoice.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { invoiceScopeFor } from "../utils/scope.js";
import { z } from "zod";

const router = express.Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const query = normalizeRole(req.user.role) === "manager" ? { recordedBy: req.user._id } : {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.method) query.method = req.query.method;
  if (req.query.from || req.query.to) {
    query.paidAt = {};
    if (req.query.from) query.paidAt.$gte = new Date(req.query.from);
    if (req.query.to) query.paidAt.$lte = new Date(req.query.to);
  }
  res.json(await Payment.find(query).populate("invoice", "invoiceNumber clientSnapshot total paidAmount status").sort({ createdAt: -1 }));
}));

router.post("/", asyncHandler(async (req, res) => {
  const data = z.object({
    invoice: z.string(),
    amount: z.coerce.number().positive(),
    currency: z.string().default("USD"),
    method: z.enum(["Card", "Bank Transfer", "UPI", "Cash", "Other"]).default("Card"),
    status: z.enum(["Succeeded", "Pending", "Failed"]).default("Succeeded"),
    transactionId: z.string().optional()
  }).parse(req.body);
  const invoice = await Invoice.findOne({ _id: data.invoice, ...invoiceScopeFor(req.user), isDeleted: { $ne: true } });
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });

  const payment = await Payment.create({ ...data, paidAt: data.status === "Succeeded" ? new Date() : undefined, recordedBy: req.user._id });
  if (invoice) {
    if (data.status === "Succeeded") invoice.paidAmount = Number(invoice.paidAmount || 0) + Number(data.amount || 0);
    invoice.paymentMethod = data.method;
    invoice.paymentStatus = invoice.paidAmount >= invoice.total ? "Paid" : invoice.paidAmount > 0 ? "Partial" : "Unpaid";
    if (data.status === "Succeeded") invoice.status = invoice.paidAmount >= invoice.total ? "Paid" : "Sent";
    invoice.history.push({ action: "Payment recorded", status: invoice.status, note: `${data.method} ${data.status}`, by: req.user._id, at: new Date() });
    await invoice.save();
  }
  res.status(201).json(payment);
}));

export default router;

function normalizeRole(role = "") {
  return String(role).trim().toLowerCase().replace(/\s+/g, " ");
}
