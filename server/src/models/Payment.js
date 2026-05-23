import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    method: { type: String, enum: ["Card", "Bank Transfer", "UPI", "Cash", "Other"], default: "Card" },
    status: { type: String, enum: ["Succeeded", "Pending", "Failed"], default: "Pending" },
    transactionId: String,
    paidAt: Date,
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);
