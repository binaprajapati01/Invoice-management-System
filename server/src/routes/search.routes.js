import express from "express";
import Invoice from "../models/Invoice.js";
import Client from "../models/Client.js";
import User from "../models/User.js";
import ActivityLog from "../models/ActivityLog.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { invoiceScopeFor, userScopeFor } from "../utils/scope.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.json([]);
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const [invoices, clients, users] = await Promise.all([
    Invoice.find({
      ...invoiceScopeFor(req.user),
      $or: [{ invoiceNumber: regex }, { "clientSnapshot.name": regex }, { "clientSnapshot.email": regex }]
    }).limit(6).select("invoiceNumber clientSnapshot status total currency"),
    Client.find({ $or: [{ name: regex }, { email: regex }, { company: regex }] }).limit(6).select("name email company status"),
    ["Super Admin", "Admin"].includes(req.user.role)
      ? User.find({ ...userScopeFor(req.user), $or: [{ name: regex }, { email: regex }, { role: regex }] }).limit(6).select("name email role isActive")
      : []
  ]);

  res.json([
    ...invoices.map((item) => ({ id: item._id, type: "Invoice", title: item.invoiceNumber, subtitle: item.clientSnapshot?.name, href: `/invoices/${item._id}/edit`, meta: item.status })),
    ...clients.map((item) => ({ id: item._id, type: "Client", title: item.company || item.name, subtitle: item.email, href: "/clients", meta: item.status })),
    ...users.map((item) => ({ id: item._id, type: "User", title: item.name, subtitle: item.email, href: item.role === "Admin" ? "/admins" : "/managers", meta: item.role }))
  ]);
}));

router.get("/notifications", asyncHandler(async (req, res) => {
  const invoiceScope = invoiceScopeFor(req.user);
  const dueSoon = await Invoice.find({
    ...invoiceScope,
    status: { $in: ["Sent", "Pending", "Overdue"] },
    dueDate: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
  }).sort({ dueDate: 1 }).limit(8).select("invoiceNumber clientSnapshot status dueDate total currency");

  const logItems = ["Super Admin", "Admin"].includes(req.user.role)
    ? await ActivityLog.find().populate("actor", "name").sort({ createdAt: -1 }).limit(6)
    : [];

  res.json([
    ...dueSoon.map((invoice) => ({
      id: invoice._id,
      title: `${invoice.invoiceNumber} ${invoice.status}`,
      body: `${invoice.clientSnapshot?.name || "Client"} due ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "soon"}`,
      href: `/invoices/${invoice._id}/edit`,
      createdAt: invoice.dueDate || invoice.updatedAt,
      tone: invoice.status === "Overdue" ? "danger" : "info"
    })),
    ...logItems.map((log) => ({
      id: log._id,
      title: log.action,
      body: `${log.actor?.name || "System"} • ${log.entity}`,
      href: "/logs",
      createdAt: log.createdAt,
      tone: "neutral"
    }))
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 12));
}));

export default router;
