import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8 },
    role: {
      type: String,
      enum: ["Super Admin", "Admin", "Manager"],
      default: "Manager",
      set: normalizeRoleName
    },
    avatar: String,
    phone: String,
    department: String,
    permissions: [{ type: String }],
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
    otp: String,
    otpExpiresAt: Date,
    resetToken: String,
    resetExpiresAt: Date,
    refreshToken: String
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.password);
};

function normalizeRoleName(role = "Manager") {
  const normalized = String(role).trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized === "super admin" || normalized === "superadmin") return "Super Admin";
  if (normalized === "admin") return "Admin";
  return "Manager";
}

export default mongoose.model("User", userSchema);
