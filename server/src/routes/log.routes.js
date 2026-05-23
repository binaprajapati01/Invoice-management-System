import express from "express";
import ActivityLog from "../models/ActivityLog.js";
import { requireAuth, permit } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth, permit("Super Admin", "Admin"));

router.get("/", async (_req, res) => {
  res.json(await ActivityLog.find().populate("actor", "name email role").sort({ createdAt: -1 }).limit(100));
});

export default router;
