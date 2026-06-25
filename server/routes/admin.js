const express = require("express");
const bcrypt = require("bcryptjs");
const { all, get, run } = require("../db");
const { requireAdmin } = require("../middleware");
const { writeAudit } = require("../audit");

const router = express.Router();
router.use(requireAdmin);

function maskPhone(phone) {
  const text = String(phone || "").trim();
  if (!text) return "";
  if (text.length < 7) return `${text.slice(0, 2)}****`;
  return `${text.slice(0, 3)}****${text.slice(-4)}`;
}

router.get("/summary", (req, res) => {
  const summary = {
    doctors: get("SELECT COUNT(*) AS count FROM users WHERE role = 'doctor'").count,
    patients: get("SELECT COUNT(*) AS count FROM patients").count,
    followups: get("SELECT COUNT(*) AS count FROM followups").count,
    adverseReactions: get("SELECT COUNT(*) AS count FROM followups WHERE has_adverse_reaction = 1").count,
    consentPending: get("SELECT COUNT(*) AS count FROM patients WHERE consent_signed = 0").count
  };
  res.json({ summary });
});

router.get("/doctors", (req, res) => {
  const doctors = all(`
    SELECT id, username, display_name, department, is_active, created_at
    FROM users
    WHERE role = 'doctor'
    ORDER BY id DESC
  `);
  res.json({ doctors });
});

router.post("/doctors", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const displayName = String(req.body.display_name || "").trim();
  const department = String(req.body.department || "").trim();

  if (!/^[A-Za-z0-9_-]{3,32}$/.test(username)) {
    return res.status(400).json({ error: "用户名需为3-32位字母、数字、下划线或短横线" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "密码至少6位" });
  }
  if (!displayName) {
    return res.status(400).json({ error: "请填写医生姓名" });
  }

  const exists = get("SELECT id FROM users WHERE username = ?", [username]);
  if (exists) {
    return res.status(409).json({ error: "用户名已存在" });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = run(`
    INSERT INTO users (username, password_hash, role, display_name, department)
    VALUES (?, ?, 'doctor', ?, ?)
  `, [username, passwordHash, displayName, department]);

  const doctor = get(`
    SELECT id, username, display_name, department, is_active, created_at
    FROM users WHERE id = ?
  `, [result.lastID]);

  writeAudit(req, "创建医生账号", "user", doctor.id, `创建医生账号：${doctor.username}`);
  res.status(201).json({ doctor });
});

router.get("/patients", (req, res) => {
  const patients = all(`
    SELECT
      p.id, p.patient_id, p.research_id, p.name, p.sex, p.age, p.diagnosis, p.tcm_syndrome,
      p.phone, p.medication_start_date, p.consent_signed, p.consent_time,
      p.token_disabled, p.created_at,
      u.display_name AS doctor_name,
      COUNT(f.id) AS followup_count,
      MAX(f.visit_date) AS last_followup_date
    FROM patients p
    JOIN users u ON u.id = p.doctor_id
    LEFT JOIN followups f ON f.patient_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).map((patient) => ({
    ...patient,
    phone: undefined,
    phone_masked: maskPhone(patient.phone)
  }));
  res.json({ patients });
});

router.get("/audit-logs", (req, res) => {
  const logs = all(`
    SELECT *
    FROM audit_logs
    ORDER BY created_at DESC, id DESC
    LIMIT 200
  `);
  res.json({ logs });
});

module.exports = router;
