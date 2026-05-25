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
    if (!hasRole(req.user?.role, roles)) return res.status(403).json({ message: "Insufficient permissions" });
    next();
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    if (!hasRole(req.user.role, roles)) {
      return res.status(403).json({ message: "Access denied: insufficient role" });
    }
    next();
  };
}

export function requireAdmin(req, res, next) {
  const role = normalizeRole(req.user?.role);
  if (!["admin", "super admin", "superadmin"].includes(role)) {
    return res.status(403).json({ message: "Access denied: insufficient role" });
  }
  next();
}

export function requireOwnerOrRoles(ownerField, ...roles) {
  return (req, res, next) => {
    if (hasRole(req.user?.role, roles)) return next();
    if (String(req.resource?.[ownerField]) === String(req.user._id)) return next();
    return res.status(403).json({ message: "You cannot access this resource" });
  };
}

function hasRole(actualRole, allowedRoles) {
  const normalized = normalizeRole(actualRole);
  const compact = compactRole(normalized);
  return allowedRoles.some((role) => {
    const allowed = normalizeRole(role);
    return allowed === normalized || compactRole(allowed) === compact;
  });
}

function normalizeRole(role = "") {
  return String(role).trim().toLowerCase().replace(/\s+/g, " ");
}

function compactRole(role = "") {
  return String(role).replace(/\s+/g, "");
}
