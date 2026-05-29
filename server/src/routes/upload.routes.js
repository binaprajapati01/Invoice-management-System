import express from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { cloudinary, configureCloudinary } from "../config/cloudinary.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post("/", requireAuth, upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "File is required" });
  const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
  if (!configureCloudinary()) return res.status(201).json({ url: dataUri, base64: dataUri });
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `webcultivation/${req.user.role.replaceAll(" ", "-").toLowerCase()}`,
    resource_type: "auto"
  });
  res.status(201).json({ url: result.secure_url, publicId: result.public_id });
}));

export default router;
