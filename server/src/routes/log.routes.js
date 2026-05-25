import express from "express";
import ActivityLog from "../models/ActivityLog.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { userScopeFor } from "../utils/scope.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.userId) filter.actor = req.query.userId;
  if (req.query.action) filter.action = new RegExp(req.query.action, "i");

  if (req.user.role === "Manager") {
    filter.actor = req.user._id;
  } else if (req.query.role || req.user.role === "Admin") {
    const userQuery = req.user.role === "Super Admin" ? {} : userScopeFor(req.user);
    if (req.query.role) userQuery.role = req.query.role;
    const scopedUsers = await User.find(userQuery).select("_id");
    const scopedIds = scopedUsers.map((user) => user._id);
    filter.actor = filter.actor ? { $in: scopedIds.filter((id) => String(id) === String(filter.actor)) } : { $in: scopedIds };
  }

  const logs = await ActivityLog.find(filter)
    .populate("actor", "name email role")
    .sort({ createdAt: -1 })
    .limit(Number(req.query.limit) || 200);
  res.json(logs);
}));

export default router;
