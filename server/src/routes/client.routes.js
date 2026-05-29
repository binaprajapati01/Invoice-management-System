import express from "express";
import Client from "../models/Client.js";
import Invoice from "../models/Invoice.js";
import { requireAuth } from "../middleware/auth.js";
import { logActivity } from "../utils/logActivity.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { z } from "zod";

const router = express.Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const query = clientScopeFor(req.user);
  const clients = await Client.find(query).sort({ createdAt: -1 });
  res.json(clients);
}));

router.get("/:id/invoices", asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.id, ...clientScopeFor(req.user) });
  if (!client) return res.status(404).json({ message: "Client not found" });
  const invoices = await Invoice.find({ client: client._id, isDeleted: { $ne: true } }).sort({ issueDate: -1 });
  res.json(invoices);
}));

const clientSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pincode: z.string().optional(),
  GSTIN: z.string().optional(),
  panNumber: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
  taxId: z.string().optional(),
  currency: z.string().default("INR"),
  status: z.enum(["Active", "Inactive"]).default("Active")
});

router.post("/", asyncHandler(async (req, res) => {
    const client = await Client.create({ ...clientSchema.parse(req.body), createdBy: req.user._id });
    await logActivity(req, "Created client", "Client", client._id);
    res.status(201).json(client);
}));

router.patch("/:id", asyncHandler(async (req, res) => {
  const query = { _id: req.params.id, ...clientScopeFor(req.user) };
  const client = await Client.findOneAndUpdate(query, clientSchema.partial().parse(req.body), { new: true });
  if (!client) return res.status(404).json({ message: "Client not found" });
  res.json(client);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const query = { _id: req.params.id, ...clientScopeFor(req.user) };
  const client = await Client.findOneAndDelete(query);
  if (!client) return res.status(404).json({ message: "Client not found" });
  res.status(204).end();
}));

export default router;

function clientScopeFor(user) {
  return normalizeRole(user.role) === "manager" ? { createdBy: user._id } : {};
}

function normalizeRole(role = "") {
  return String(role).trim().toLowerCase().replace(/\s+/g, " ");
}
