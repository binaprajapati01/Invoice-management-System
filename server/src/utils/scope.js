export function canManageUser(actorRole, targetRole) {
  if (actorRole === "Super Admin") return ["Admin", "Manager"].includes(targetRole);
  if (actorRole === "Admin") return targetRole === "Manager";
  return false;
}

export function userScopeFor(actor) {
  if (actor.role === "Super Admin") return { role: { $in: ["Admin", "Manager"] } };
  if (actor.role === "Admin") return { role: "Manager" };
  return { _id: actor._id };
}

export function invoiceScopeFor(actor) {
  if (actor.role === "Manager") return { createdBy: actor._id };
  return {};
}
