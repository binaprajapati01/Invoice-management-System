import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    company: String,
    address: String,
    city: String,
    state: String,
    country: String,
    pincode: String,
    GSTIN: String,
    panNumber: String,
    website: String,
    notes: String,
    taxId: String,
    currency: { type: String, default: "USD" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("Client", clientSchema);
