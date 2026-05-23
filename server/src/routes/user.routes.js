import express from "express";
import { z } from "zod";
import User from "../models/User.js";
import { requireAuth, permit } from "../middleware/auth.js";
import { logActivity } from "../utils/logActivity.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { canManageUser, userScopeFor } from "../utils/scope.js";

const router = express.Router();
router.use(requireAuth);

router.patch("/me/profile", asyncHandler(async (req, res) => {
  const updates = z.object({
    name: z.string().min(2).optional(),
    phone: z.string().optional(),
    department: z.string().optional(),
    avatar: z.string().optional()
  }).parse(req.body);
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select("-password");
  await logActivity(req, "Updated profile", "User", req.user._id);
  res.json(user);
}));

router.get("/", permit("Super Admin", "Admin"), asyncHandler(async (req, res) => {
  const users = await User.find(userScopeFor(req.user)).select("-password").sort({ createdAt: -1 });
  res.json(users);
}));

router.post("/", permit("Super Admin", "Admin"), asyncHandler(async (req, res) => {
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

router.delete("/:id", permit("Super Admin", "Admin"), asyncHandler(async (req, res) => {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });
    if (!canManageUser(req.user.role, target.role)) return res.status(403).json({ message: "Cannot delete this user" });
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    await logActivity(req, "Deactivated account", "User", req.params.id);
    res.status(204).end();
}));

export default router;
