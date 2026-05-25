import express from "express";
import User from "../models/User.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { logActivity } from "../utils/logActivity.js";

const router = express.Router();

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const manager = await User.findById(req.params.id);
    if (!manager || normalizeRole(manager.role) !== "manager") {
      return res.status(404).json({ message: "Manager not found" });
    }

    await User.findByIdAndDelete(req.params.id);
    await logActivity(req, "Deleted manager", "User", req.params.id);
    res.status(200).json({ message: "Manager deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

function normalizeRole(role = "") {
  return String(role).trim().toLowerCase().replace(/\s+/g, " ");
}

export default router;
