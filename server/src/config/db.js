import mongoose from "mongoose";
import User from "../models/User.js";
import Settings from "../models/Settings.js";

const seedUsers = [
  { name: "Sophia Carter", email: "super@invoiceflow.com", password: "password123", role: "Super Admin" },
  { name: "Aarav Mehta", email: "admin@invoiceflow.com", password: "password123", role: "Admin" },
  { name: "Maya Iyer", email: "manager@invoiceflow.com", password: "password123", role: "Manager" }
];

export default async function connectDB() {
  if (!process.env.MONGODB_URI) {
    console.warn("MONGODB_URI missing. API will start, but database operations require MongoDB.");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");

    const count = await User.countDocuments();
    if (!count) {
      await User.insertMany(seedUsers);
      await Settings.create({
        companyName: "InvoiceFlow Global",
        currency: "USD",
        taxRate: 18,
        accentColor: "#2563EB",
        notifications: { email: true, payments: true, security: true }
      });
      console.log("Seeded initial users: super/admin/manager @invoiceflow.com. Change default passwords before production use.");
    }
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
  }
}
