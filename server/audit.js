const { run } = require("./db");

function actorFromRequest(req, fallback = {}) {
  const user = req.session && req.session.user;
  if (user) {
    return {
      actor_id: user.id,
      actor_name: user.display_name || user.username || "未知用户",
      actor_role: user.role || "unknown"
    };
  }
  return {
    actor_id: fallback.actor_id || null,
    actor_name: fallback.actor_name || "患者随访链接",
    actor_role: fallback.actor_role || "patient"
  };
}

function writeAudit(req, actionType, objectType, objectId, summary, fallbackActor) {
  const actor = actorFromRequest(req, fallbackActor);
  run(`
    INSERT INTO audit_logs (
      actor_id, actor_name, actor_role, action_type, object_type, object_id, summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    actor.actor_id,
    actor.actor_name,
    actor.actor_role,
    actionType,
    objectType,
    objectId === undefined || objectId === null ? "" : String(objectId),
    summary || ""
  ]);
}

module.exports = {
  writeAudit
};
