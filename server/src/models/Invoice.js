import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
    quantity: { type: Number, default: 1 },
    price: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 }
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    status: { type: String, enum: ["Draft", "Sent", "Paid", "Pending", "Overdue", "Cancelled"], default: "Draft" },
    currency: { type: String, default: "USD" },
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
    clientSnapshot: {
      name: String,
      email: String,
      address: String,
      taxId: String
    },
    company: {
      name: String,
      email: String,
      address: String,
      logo: String,
      signature: String
    },
    items: [itemSchema],
    subtotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    dueDate: Date,
    issueDate: { type: Date, default: Date.now },
    paymentTerms: String,
    notes: String,
    terms: String,
    bank: {
      accountNo: String,
      ifsc: String,
      bankName: String,
      accountName: String
    },
    qrPaymentUrl: String,
    watermark: String,
    template: { type: mongoose.Schema.Types.ObjectId, ref: "Template" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date
  },
  { timestamps: true }
);

export default mongoose.model("Invoice", invoiceSchema);
