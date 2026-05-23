import mongoose from "mongoose";

const templateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    category: { type: String, default: "Business" },
    thumbnail: String,
    fields: [{ label: String, key: String, required: Boolean }],
    layout: { type: Object, default: {} },
    accentColor: { type: String, default: "#2563EB" },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("Template", templateSchema);
