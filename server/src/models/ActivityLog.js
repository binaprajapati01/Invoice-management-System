import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    entity: String,
    entityId: String,
    metadata: Object,
    ip: String
  },
  { timestamps: true }
);

export default mongoose.model("ActivityLog", activityLogSchema);
