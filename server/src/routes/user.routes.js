import express from "express";
import { z } from "zod";
import User from "../models/User.js";
import { requireAuth, permit, requireRole } from "../middleware/auth.js";
import { logActivity } from "../utils/logActivity.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { canManageUser, userScopeFor } from "../utils/scope.js";

const router = express.Router();
router.use(requireAuth);

router.patch("/me", asyncHandler(updateMe));
router.patch("/me/profile", asyncHandler(updateMe));

async function updateMe(req, res) {
  const updates = z.object({
    name: z.string().min(2).optional(),
    phone: z.string().optional(),
    department: z.string().optional(),
    avatar: z.string().optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8).optional()
  }).parse(req.body);

  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ message: "User not found" });

  if (updates.newPassword) {
    if (!updates.currentPassword || !(await user.comparePassword(updates.currentPassword))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    user.password = updates.newPassword;
  }

  ["name", "phone", "department", "avatar"].forEach((field) => {
    if (updates[field] !== undefined) user[field] = updates[field];
  });

  await user.save();
  await logActivity(req, "Updated profile", "User", req.user._id);
  res.json(safeUser(user));
}

router.get("/", permit("Super Admin", "Admin"), asyncHandler(async (req, res) => {
  const users = await User.find(userScopeFor(req.user)).select("-password").sort({ createdAt: -1 });
  res.json(users);
}));

router.post("/", requireRole("Super Admin", "Admin"), asyncHandler(async (req, res) => {
    const data = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8),
      role: z.enum(["Admin", "Manager"])
    }).parse(req.body);
    if (!canManageUser(req.user.role, data.role)) return res.status(403).json({ message: "Role assignment not allowed" });
    const user = await User.create(data);
    await logActivity(req, `Created ${data.role}`, "User", user._id);
    const safeUser = user.toObject();
    delete safeUser.password;
    res.status(201).json(safeUser);
}));

router.patch("/:id", permit("Super Admin", "Admin"), asyncHandler(async (req, res) => {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });
    if (!canManageUser(req.user.role, target.role)) return res.status(403).json({ message: "Cannot edit this user" });
    const updates = z.object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
      role: z.enum(["Admin", "Manager"]).optional(),
      phone: z.string().optional(),
      department: z.string().optional(),
      permissions: z.array(z.string()).optional(),
      isActive: z.boolean().optional()
    }).parse(req.body);
    if (updates.role && !canManageUser(req.user.role, updates.role)) return res.status(403).json({ message: "Role assignment not allowed" });
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select("-password");
    await logActivity(req, "Updated account", "User", req.params.id);
    res.json(user);
}));

router.delete("/:id", requireRole("Super Admin", "Admin"), asyncHandler(async (req, res) => {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });
    if (!canManageUser(req.user.role, target.role)) return res.status(403).json({ message: "Cannot delete this user" });
    await User.findByIdAndDelete(req.params.id);
    await logActivity(req, "Deleted account", "User", req.params.id);
    res.status(200).json({ message: "User deleted successfully" });
}));

function safeUser(user) {
  const data = user.toObject ? user.toObject() : { ...user };
  delete data.password;
  delete data.otp;
  delete data.resetToken;
  delete data.refreshToken;
  return data;
}

export default router;
