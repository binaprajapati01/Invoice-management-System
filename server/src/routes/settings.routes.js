import express from "express";
import Settings from "../models/Settings.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (_req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({ companyName: "InvoiceFlow" });
  res.json(settings);
}));

router.patch("/", requireRole("Super Admin", "Admin"), asyncHandler(async (req, res) => {
  const current = await Settings.findOne();
  const settings = current
    ? await Settings.findByIdAndUpdate(current._id, req.body, { new: true })
    : await Settings.create(req.body);
  res.json(settings);
}));

export default router;
