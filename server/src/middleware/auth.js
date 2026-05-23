import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Authentication token required" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    const user = await User.findById(decoded.id).select("-password");
    if (!user || !user.isActive) return res.status(401).json({ message: "Invalid or inactive account" });
    req.user = user;
    next();
  } catch (_error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function permit(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: "Insufficient permissions" });
    next();
  };
}

export function requireOwnerOrRoles(ownerField, ...roles) {
  return (req, res, next) => {
    if (roles.includes(req.user.role)) return next();
    if (String(req.resource?.[ownerField]) === String(req.user._id)) return next();
    return res.status(403).json({ message: "You cannot access this resource" });
  };
}
