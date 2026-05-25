export function canManageUser(actorRole, targetRole) {
  const actor = normalizeRole(actorRole);
  const target = normalizeRole(targetRole);
  if (actor === "super admin" || actor === "superadmin") return ["admin", "manager"].includes(target);
  if (actor === "admin") return target === "manager";
  return false;
}

export function userScopeFor(actor) {
  const role = normalizeRole(actor.role);
  if (role === "super admin" || role === "superadmin") return { role: { $in: ["Admin", "Manager", "admin", "manager"] } };
  if (role === "admin") return { role: { $in: ["Manager", "manager"] } };
  return { _id: actor._id };
}

export function invoiceScopeFor(actor) {
  if (normalizeRole(actor.role) === "manager") return { createdBy: actor._id };
  return {};
}

function normalizeRole(role = "") {
  return String(role).trim().toLowerCase().replace(/\s+/g, " ");
}
