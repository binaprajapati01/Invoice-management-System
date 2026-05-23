import ActivityLog from "../models/ActivityLog.js";

export async function logActivity(req, action, entity, entityId, metadata = {}) {
  try {
    await ActivityLog.create({
      actor: req.user?._id,
      action,
      entity,
      entityId,
      metadata,
      ip: req.ip
    });
  } catch (error) {
    console.warn("Activity logging failed:", error.message);
  }
}
