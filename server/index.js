import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import connectDB from "./src/config/db.js";
import authRoutes from "./src/routes/auth.routes.js";
import managerRoutes from "./src/routes/manager.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import invoiceRoutes from "./src/routes/invoice.routes.js";
import clientRoutes from "./src/routes/client.routes.js";
import templateRoutes from "./src/routes/template.routes.js";
import reportRoutes from "./src/routes/report.routes.js";
import settingsRoutes from "./src/routes/settings.routes.js";
import paymentRoutes from "./src/routes/payment.routes.js";
import logRoutes from "./src/routes/log.routes.js";
import uploadRoutes from "./src/routes/upload.routes.js";
import searchRoutes from "./src/routes/search.routes.js";
import { startScheduler } from "./src/utils/scheduler.js";

// ✅ Env check
const required = ["MONGODB_URI", "JWT_SECRET"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`[Startup] Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const app = express();  // ✅ Sirf ek baar
const PORT = process.env.PORT || 5000;

await connectDB();

if (process.env.NODE_ENV !== "test") {
  startScheduler();
  console.log("Schedulers started");
}

app.use(cors({ 
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));  // ✅ Sirf ek baar
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));

// ✅ Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "Web Cultivation API", time: new Date().toISOString() });
});

// ✅ Routes
app.use("/auth", authRoutes); 
app.use("/api/auth", authRoutes);
app.use("/api/managers", managerRoutes);
app.use("/api/users", userRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/analytics", reportRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/search", searchRoutes);

// ✅ Error handler
app.use((err, _req, res, _next) => {
  if (err.name === "ZodError") {
    return res.status(400).json({ message: err.errors?.[0]?.message || "Validation failed", errors: err.errors });
  }
  res.status(err.status || 500).json({ message: err.message || "Something went wrong" });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
export default app;