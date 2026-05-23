import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { logActivity } from "../utils/logActivity.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createMailer } from "../config/mail.js";

const router = express.Router();
const signToken = (user) => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "15m" });
const signRefreshToken = (user) => jwt.sign({ id: user._id, role: user.role, type: "refresh" }, process.env.JWT_SECRET || "dev-secret", { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" });

async function registerUser(req, res) {
    const data = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8)
    }).parse(req.body);
    const userCount = await User.countDocuments();
    const user = await User.create({ ...data, role: userCount === 0 ? "Super Admin" : "Manager" });
    res.status(201).json({ message: "Account created", user: safeUser(user) });
}

router.post("/signup", asyncHandler(registerUser));
router.post("/register", asyncHandler(registerUser));

router.post("/login", asyncHandler(async (req, res) => {
    const { email, password, role } = z.object({
      email: z.string().email(),
      password: z.string().min(1),
      role: z.enum(["Super Admin", "Admin", "Manager"]).optional()
    }).parse(req.body);
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ message: "Invalid credentials" });
    if (role && role !== user.role) return res.status(403).json({ message: `This account is not assigned to ${role}` });
    user.lastLogin = new Date();
    user.refreshToken = signRefreshToken(user);
    await user.save();
    await logActivity({ user, ip: req.ip }, "Logged in", "User", user._id);
    res.json({ token: signToken(user), refreshToken: user.refreshToken, user: safeUser(user) });
}));

router.post("/refresh", asyncHandler(async (req, res) => {
  const refreshToken = req.body.refreshToken || req.headers["x-refresh-token"];
  if (!refreshToken) return res.status(401).json({ message: "Refresh token required" });
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || "dev-secret");
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }
  const user = await User.findById(decoded.id);
  if (!user || user.refreshToken !== refreshToken || !user.isActive) return res.status(401).json({ message: "Invalid refresh session" });
  res.json({ token: signToken(user), refreshToken, user: safeUser(user) });
}));

router.post("/logout", requireAuth, asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: "" } });
  res.json({ message: "Logged out" });
}));

router.post("/forgot-password", asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await User.findOne({ email });
    if (user) {
      user.otp = String(Math.floor(100000 + Math.random() * 900000));
      user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      user.resetToken = crypto.randomBytes(24).toString("hex");
      user.resetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();
      const mailer = createMailer();
      if (mailer) {
        await mailer.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: user.email,
          subject: "InvoiceFlow password reset",
          html: `<p>Hello ${user.name},</p><p>Your InvoiceFlow OTP is <strong>${user.otp}</strong>. It expires in 10 minutes.</p><p>Use this reset token after OTP verification: <code>${user.resetToken}</code></p>`
        });
      }
    }
    res.json({ message: "If the email exists, reset instructions have been sent." });
}));

router.post("/verify-otp", asyncHandler(async (req, res) => {
    const { email, otp } = z.object({ email: z.string().email(), otp: z.string().length(6) }).parse(req.body);
    const user = await User.findOne({ email, otp, otpExpiresAt: { $gt: new Date() } });
    if (!user) return res.status(400).json({ message: "Invalid or expired OTP" });
    res.json({ message: "OTP verified", resetToken: user.resetToken });
}));

router.post("/reset-password", asyncHandler(async (req, res) => {
    const { token, password } = z.object({ token: z.string().min(20), password: z.string().min(8) }).parse(req.body);
    const user = await User.findOne({ resetToken: token, resetExpiresAt: { $gt: new Date() } });
    if (!user) return res.status(400).json({ message: "Invalid or expired reset token" });
    user.password = password;
    user.otp = undefined;
    user.resetToken = undefined;
    await user.save();
    res.json({ message: "Password reset successful" });
}));

router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

function safeUser(user) {
  const data = user.toObject ? user.toObject() : { ...user };
  delete data.password;
  delete data.otp;
  delete data.resetToken;
  delete data.refreshToken;
  return data;
}

export default router;
