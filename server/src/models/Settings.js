import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    companyName: String,
    companyEmail: String,
    companyPhone: String,
    companyAddress: String,
    companyWebsite: String,
    GSTIN: String,
    PAN: String,
    CIN: String,
    logo: String,
    defaultCurrency: { type: String, default: "INR" },
    currency: { type: String, default: "INR" },
    invoicePrefix: { type: String, default: "INV" },
    defaultDueDays: { type: Number, default: 15 },
    defaultNotes: String,
    defaultTerms: String,
    upiId: String,
    bank: {
      accountName: String,
      accountNo: String,
      ifsc: String,
      bankName: String
    },
    paymentMethods: {
      UPI: { type: Boolean, default: true },
      Cash: { type: Boolean, default: true },
      Bank: { type: Boolean, default: true },
      Card: { type: Boolean, default: true }
    },
    taxRate: { type: Number, default: 0 },
    taxEnabled: { type: Boolean, default: true },
    taxLabel: { type: String, default: "GST" },
    emailSettings: {
      smtpHost: String,
      smtpPort: Number,
      smtpUser: String,
      smtpPassword: String,
      fromName: String,
      fromEmail: String,
      subjectTemplate: String,
      bodyTemplate: String
    },
    accentColor: { type: String, default: "#2563EB" },
    theme: { type: String, enum: ["light", "dark", "system"], default: "light" },
    notifications: {
      invoiceSent: { type: Boolean, default: true },
      paymentReceived: { type: Boolean, default: true },
      overdueAlerts: { type: Boolean, default: true },
      alertDaysBeforeDue: { type: Number, default: 3 }
    }
  },
  { timestamps: true }
);

export default mongoose.model("Settings", settingsSchema);
