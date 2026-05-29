import express from "express";
import Invoice from "../models/Invoice.js";
import User from "../models/User.js";
import Client from "../models/Client.js";
import Payment from "../models/Payment.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { invoiceScopeFor } from "../utils/scope.js";

const router = express.Router();
router.use(requireAuth);

router.get("/overview", asyncHandler(async (req, res) => {
  const scope = { ...invoiceScopeFor(req.user), isDeleted: { $ne: true } };
  const [invoices, users, clients, payments] = await Promise.all([
    Invoice.find(scope).lean(),
    ["super admin", "admin"].includes(normalizeRole(req.user.role)) ? User.find().select("name email role createdAt isActive").lean() : Promise.resolve([]),
    Client.find(clientScopeFor(req.user)).lean(),
    Payment.find(paymentScopeFor(req.user)).populate("invoice", "createdBy total status").lean()
  ]);
  const paidInvoices = invoices.filter((invoice) => invoice.status === "Paid");
  const admins = users.filter((user) => normalizeRole(user.role) === "admin");
  const managers = users.filter((user) => normalizeRole(user.role) === "manager");

  res.json({
    kpis: {
      totalAdmins: admins.length,
      totalManagers: managers.length,
      revenue: paidInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
      invoices: invoices.length,
      paid: paidInvoices.length,
      unpaid: invoices.filter((invoice) => invoice.status === "Sent").length,
      overdue: invoices.filter((invoice) => invoice.status === "Overdue").length,
      draft: invoices.filter((invoice) => invoice.status === "Draft").length,
      pending: invoices.filter((invoice) => ["Sent", "Overdue"].includes(invoice.status)).length,
      clients: clients.length,
      users: users.length,
      payments: payments.length
    },
    revenueSeries: buildMonthlySeries(invoices, 12),
    sixMonthRevenue: buildMonthlySeries(invoices, 6),
    invoiceSeries: buildMonthlySeries(invoices, 12).map(({ month, invoices }) => ({ month, invoices })),
    statusSeries: ["Paid", "Sent", "Draft", "Overdue", "Cancelled"].map((status) => ({
      name: status,
      value: invoices.filter((invoice) => invoice.status === status).length
    })),
    paymentMethods: ["Cash", "UPI", "Bank Transfer", "Card", "Other"].map((method) => ({
      name: method,
      value: payments.filter((payment) => payment.method === method && payment.status === "Succeeded").reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    })),
    topClients: topClients(invoices),
    roleSeries: ["Super Admin", "Admin", "Manager"].map((role) => ({ role, users: users.filter((user) => normalizeRole(user.role) === normalizeRole(role)).length })),
    managerPerformance: managers.map((manager) => {
      const managerInvoices = invoices.filter((invoice) => String(invoice.createdBy) === String(manager._id));
      return {
        manager: manager.name || manager.email,
        invoices: managerInvoices.length,
        revenue: managerInvoices.filter((invoice) => invoice.status === "Paid").reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)
      };
    })
  });
}));

router.get("/revenue", asyncHandler(async (req, res) => {
  const invoices = await Invoice.find({ ...invoiceScopeFor(req.user), isDeleted: { $ne: true } }).lean();
  res.json(buildMonthlySeries(invoices, 12));
}));

router.get("/invoices", asyncHandler(async (req, res) => {
  const invoices = await Invoice.find({ ...invoiceScopeFor(req.user), isDeleted: { $ne: true } }).lean();
  res.json(["Paid", "Sent", "Draft", "Overdue", "Cancelled"].map((status) => ({ name: status, value: invoices.filter((invoice) => invoice.status === status).length })));
}));

router.get("/clients", asyncHandler(async (req, res) => {
  const invoices = await Invoice.find({ ...invoiceScopeFor(req.user), isDeleted: { $ne: true } }).lean();
  res.json(topClients(invoices));
}));

router.get("/payments", asyncHandler(async (req, res) => {
  const payments = await Payment.find(paymentScopeFor(req.user)).lean();
  res.json(["Cash", "UPI", "Bank Transfer", "Card", "Other"].map((method) => ({ name: method, value: payments.filter((payment) => payment.method === method).length })));
}));

router.get("/export/csv", asyncHandler(async (req, res) => {
  const rows = await getReportRows(req);
  const csv = [
    ["invoiceNumber", "clientName", "status", "total", "paidAmount", "dueDate", "issueDate"],
    ...rows.map((invoice) => [
      invoice.invoiceNumber,
      invoice.clientSnapshot?.name || invoice.client?.name || "",
      invoice.status,
      invoice.total,
      invoice.paidAmount,
      formatDate(invoice.dueDate),
      formatDate(invoice.issueDate)
    ])
  ].map((row) => row.map(csvEscape).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=invoices-report.csv");
  res.send(csv);
}));

router.get("/export/excel", asyncHandler(async (req, res) => {
  const rows = await getReportRows(req);
  const html = [
    "<table>",
    "<thead><tr><th>Invoice Number</th><th>Client Name</th><th>Status</th><th>Total</th><th>Paid Amount</th><th>Due Date</th><th>Issue Date</th></tr></thead>",
    "<tbody>",
    ...rows.map((invoice) => `<tr><td>${htmlEscape(invoice.invoiceNumber)}</td><td>${htmlEscape(invoice.clientSnapshot?.name || invoice.client?.name || "")}</td><td>${htmlEscape(invoice.status)}</td><td>${Number(invoice.total || 0)}</td><td>${Number(invoice.paidAmount || 0)}</td><td>${formatDate(invoice.dueDate)}</td><td>${formatDate(invoice.issueDate)}</td></tr>`),
    "</tbody></table>"
  ].join("");

  res.setHeader("Content-Type", "application/vnd.ms-excel");
  res.setHeader("Content-Disposition", "attachment; filename=invoices-report.xls");
  res.send(html);
}));

function clientScopeFor(user) {
  return normalizeRole(user.role) === "manager" ? { createdBy: user._id } : {};
}

function paymentScopeFor(user) {
  return normalizeRole(user.role) === "manager" ? { recordedBy: user._id } : {};
}

function normalizeRole(role = "") {
  return String(role).trim().toLowerCase().replace(/\s+/g, " ");
}

function buildMonthlySeries(invoices, monthsBack) {
  const now = new Date();
  return Array.from({ length: monthsBack }).map((_item, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1 - offset), 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const rows = invoices.filter((invoice) => {
      const created = new Date(invoice.createdAt);
      return `${created.getFullYear()}-${created.getMonth()}` === key;
    });
    return {
      month: date.toLocaleString("en", { month: "short" }),
      revenue: rows.filter((invoice) => invoice.status === "Paid").reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
      invoices: rows.length,
      overdue: rows.filter((invoice) => invoice.status === "Overdue").reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)
    };
  });
}

function topClients(invoices) {
  const totals = new Map();
  invoices.filter((invoice) => invoice.status === "Paid").forEach((invoice) => {
    const name = invoice.clientSnapshot?.name || "Client";
    totals.set(name, (totals.get(name) || 0) + Number(invoice.total || 0));
  });
  return [...totals.entries()].map(([client, revenue]) => ({ client, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
}

function buildReportQuery(req) {
  const query = { ...invoiceScopeFor(req.user), isDeleted: { $ne: true } };
  if (req.query.status && req.query.status !== "All") query.status = req.query.status;

  const startDate = req.query.startDate || req.query.from;
  const endDate = req.query.endDate || req.query.to;
  if (startDate || endDate) {
    query.issueDate = {};
    if (startDate) query.issueDate.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.issueDate.$lte = end;
    }
  }

  return query;
}

function getReportRows(req) {
  return Invoice.find(buildReportQuery(req))
    .populate("client", "name email")
    .sort({ issueDate: -1 })
    .lean();
}

function formatDate(date) {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export default router;
