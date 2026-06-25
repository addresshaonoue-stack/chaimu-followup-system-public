const { get } = require("./db");

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "请先登录" });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "需要管理员权限" });
  }
  return next();
}

function requireDoctorOrAdmin(req, res, next) {
  if (!req.session.user || !["doctor", "admin"].includes(req.session.user.role)) {
    return res.status(403).json({ error: "需要医生或管理员权限" });
  }
  return next();
}

function canAccessPatient(user, patientId) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const patient = get("SELECT id, doctor_id FROM patients WHERE id = ?", [patientId]);
  return Boolean(patient && patient.doctor_id === user.id);
}

function requirePatientAccess(req, res, next) {
  const patientId = Number(req.params.id || req.params.patientId);
  if (!Number.isInteger(patientId) || patientId <= 0) {
    return res.status(400).json({ error: "患者编号无效" });
  }
  if (!canAccessPatient(req.session.user, patientId)) {
    return res.status(403).json({ error: "无权访问该患者" });
  }
  return next();
}

function currentUser(req) {
  if (!req.session.user) return null;
  return get(
    "SELECT id, username, role, display_name, department, is_active FROM users WHERE id = ? AND is_active = 1",
    [req.session.user.id]
  );
}

module.exports = {
  requireLogin,
  requireAdmin,
  requireDoctorOrAdmin,
  requirePatientAccess,
  canAccessPatient,
  currentUser
};

