import express from "express";
import Settings from "../models/Settings.js";
import { requireAuth, permit } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({ companyName: "InvoiceFlow" });
  res.json(settings);
});

router.patch("/", permit("Super Admin", "Admin"), async (req, res) => {
  const current = await Settings.findOne();
  const settings = current
    ? await Settings.findByIdAndUpdate(current._id, req.body, { new: true })
    : await Settings.create(req.body);
  res.json(settings);
});

export default router;
