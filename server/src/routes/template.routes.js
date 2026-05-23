import express from "express";
import Template from "../models/Template.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { z } from "zod";

const router = express.Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (_req, res) => {
  res.json(await Template.find().sort({ createdAt: -1 }));
}));

const templateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().default("Business"),
  thumbnail: z.string().optional(),
  fields: z.array(z.object({ label: z.string(), key: z.string(), required: z.boolean().optional() })).optional(),
  layout: z.record(z.any()).optional(),
  accentColor: z.string().default("#2563EB"),
  isDefault: z.boolean().optional()
});

router.post("/", asyncHandler(async (req, res) => {
  const template = await Template.create({ ...templateSchema.parse(req.body), createdBy: req.user._id });
  res.status(201).json(template);
}));

router.patch("/:id", asyncHandler(async (req, res) => {
  const template = await Template.findByIdAndUpdate(req.params.id, templateSchema.partial().parse(req.body), { new: true });
  if (!template) return res.status(404).json({ message: "Template not found" });
  res.json(template);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const template = await Template.findByIdAndDelete(req.params.id);
  if (!template) return res.status(404).json({ message: "Template not found" });
  res.status(204).end();
}));

export default router;
