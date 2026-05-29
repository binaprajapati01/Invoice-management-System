import express from "express";
import Settings from "../models/Settings.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createMailer, getFromAddress } from "../config/mail.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (_req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({ companyName: "Web Cultivation" });
  res.json(settings);
}));

router.patch("/", requireRole("Super Admin", "Admin"), asyncHandler(async (req, res) => {
  const current = await Settings.findOne();
  const settings = current
    ? await Settings.findByIdAndUpdate(current._id, req.body, { new: true })
    : await Settings.create(req.body);
  res.json(settings);
}));

router.post("/test-email", requireRole("Super Admin", "Admin"), asyncHandler(async (req, res) => {
  const settings = await Settings.findOne();
  const mailer = createMailer(settings);
  if (!mailer) return res.status(503).json({ message: "SMTP is not configured" });
  const to = req.body?.to || settings?.emailSettings?.fromEmail || settings?.companyEmail;
  if (!to) return res.status(400).json({ message: "A test recipient email is required" });
  await mailer.sendMail({
    from: getFromAddress(settings),
    to,
    subject: "Web Cultivation SMTP test",
    html: "<p>Your Web Cultivation SMTP settings are working.</p>"
  });
  res.json({ message: "Test email sent" });
}));

export default router;
