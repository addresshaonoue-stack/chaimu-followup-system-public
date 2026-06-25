const crypto = require("crypto");
const express = require("express");
const dayjs = require("dayjs");
const QRCode = require("qrcode");
const { all, get, run, transaction } = require("../db");
const { writeAudit } = require("../audit");
const {
  requireDoctorOrAdmin,
  requirePatientAccess,
  canAccessPatient
} = require("../middleware");
const { computePatientRisks } = require("../risk");

const router = express.Router();
router.use(requireDoctorOrAdmin);

const DEFAULT_SCHEDULES = [
  { label: "第0天基线", offset: 0 },
  { label: "第7天", offset: 7 },
  { label: "第14天", offset: 14 },
  { label: "第28天", offset: 28 },
  { label: "第56天", offset: 56 },
  { label: "第84天", offset: 84 }
];

function randomToken() {
  return crypto.randomBytes(24).toString("hex");
}

function nextPatientCode() {
  const prefix = `CMKY-${dayjs().format("YYYYMMDD")}`;
  const row = get("SELECT COUNT(*) AS count FROM patients WHERE patient_id LIKE ?", [`${prefix}-%`]);
  return `${prefix}-${String(row.count + 1).padStart(3, "0")}`;
}

function nextResearchId() {
  const year = dayjs().format("YYYY");
  const prefix = `CMKY-${year}-`;
  const rows = all("SELECT research_id FROM patients WHERE research_id LIKE ?", [`${prefix}%`]);
  const maxNumber = rows.reduce((max, row) => {
    const number = Number(String(row.research_id || "").slice(prefix.length));
    return Number.isInteger(number) && number > max ? number : max;
  }, 0);
  return `${prefix}${String(maxNumber + 1).padStart(4, "0")}`;
}

function parseBool(value) {
  return value === true || value === 1 || value === "1" || value === "true" ? 1 : 0;
}

function maskPhone(phone) {
  const text = String(phone || "").trim();
  if (!text) return "";
  if (text.length < 7) return `${text.slice(0, 2)}****`;
  return `${text.slice(0, 3)}****${text.slice(-4)}`;
}

function buildPatientSummary(patient, followups) {
  const schedules = all(`
    SELECT
      s.id, s.label, s.due_date,
      f.id AS followup_id
    FROM followup_schedules s
    LEFT JOIN followups f ON f.schedule_id = s.id
    WHERE s.patient_id = ?
    ORDER BY s.due_date ASC, s.id ASC
  `, [patient.id]);
  const completed = schedules.filter((item) => item.followup_id).length;
  const nextSchedule = schedules.find((item) => !item.followup_id) || null;
  const today = dayjs().format("YYYY-MM-DD");
  const risks = computePatientRisks(patient, followups);

  return {
    ...patient,
    phone: undefined,
    phone_masked: maskPhone(patient.phone),
    followup_count: followups.length,
    last_followup_date: followups.length ? followups[followups.length - 1].visit_date : null,
    next_due_date: nextSchedule ? nextSchedule.due_date : null,
    next_due_label: nextSchedule ? nextSchedule.label : null,
    is_overdue: nextSchedule ? nextSchedule.due_date < today : 0,
    schedule_total: schedules.length,
    schedule_completed: completed,
    completion_rate: schedules.length ? Math.round((completed / schedules.length) * 1000) / 10 : 0,
    adverse_count: followups.filter((item) => item.has_adverse_reaction).length,
    risk_level: risks.some((item) => item.level === "danger") ? "高" : risks.length ? "中" : "低",
    risks
  };
}

function getPatientOr404(id) {
  return get(`
    SELECT
      p.*,
      u.display_name AS doctor_name,
      u.department AS doctor_department
    FROM patients p
    JOIN users u ON u.id = p.doctor_id
    WHERE p.id = ?
  `, [id]);
}

function getPatientFollowups(id) {
  return all(`
    SELECT *
    FROM followups
    WHERE patient_id = ?
    ORDER BY visit_date ASC, id ASC
  `, [id]);
}

router.get("/", (req, res) => {
  const params = [];
  let where = "";
  if (req.session.user.role === "doctor") {
    where = "WHERE p.doctor_id = ?";
    params.push(req.session.user.id);
  }

  const patients = all(`
    SELECT
      p.id, p.patient_id, p.name, p.sex, p.age, p.phone, p.diagnosis, p.tcm_syndrome,
      p.research_id, p.medication_start_date, p.consent_signed, p.consent_time,
      p.token_disabled, p.token_disabled_at, p.notes, p.created_at,
      u.display_name AS doctor_name
    FROM patients p
    JOIN users u ON u.id = p.doctor_id
    ${where}
    ORDER BY p.created_at DESC
  `, params).map((patient) => buildPatientSummary(patient, getPatientFollowups(patient.id)));

  res.json({ patients });
});

router.post("/", (req, res) => {
  const body = req.body || {};
  const name = String(body.name || "").trim();
  const sex = String(body.sex || "").trim();
  const age = Number(body.age);
  const phone = String(body.phone || "").trim();
  const diagnosis = String(body.diagnosis || "").trim();
  const tcmSyndrome = String(body.tcm_syndrome || "").trim();
  const medicationStartDate = String(body.medication_start_date || "").trim();
  const notes = String(body.notes || "").trim();

  if (!name || !["男", "女", "其他"].includes(sex) || !Number.isInteger(age) || age < 0 || age > 120) {
    return res.status(400).json({ error: "请填写有效的姓名、性别和年龄" });
  }
  if (!diagnosis || !tcmSyndrome || !dayjs(medicationStartDate).isValid()) {
    return res.status(400).json({ error: "请填写诊断、证型和开始用药日期" });
  }

  let doctorId = req.session.user.id;
  if (req.session.user.role === "admin" && body.doctor_id) {
    const doctor = get("SELECT id FROM users WHERE id = ? AND role = 'doctor' AND is_active = 1", [Number(body.doctor_id)]);
    if (!doctor) return res.status(400).json({ error: "管理医生无效" });
    doctorId = doctor.id;
  }

  const createPatient = transaction(() => {
    let code = nextPatientCode();
    while (get("SELECT id FROM patients WHERE patient_id = ?", [code])) {
      code = nextPatientCode();
    }

    const result = run(`
      INSERT INTO patients (
        patient_id, research_id, token, name, sex, age, phone, diagnosis, tcm_syndrome,
        medication_start_date, doctor_id, consent_signed, consent_time, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      code,
      nextResearchId(),
      randomToken(),
      name,
      sex,
      age,
      phone,
      diagnosis,
      tcmSyndrome,
      dayjs(medicationStartDate).format("YYYY-MM-DD"),
      doctorId,
      parseBool(body.consent_signed),
      parseBool(body.consent_signed) ? dayjs().format("YYYY-MM-DD HH:mm:ss") : null,
      notes
    ]);

    DEFAULT_SCHEDULES.forEach((item) => {
      run(`
        INSERT INTO followup_schedules (patient_id, label, due_date, is_custom, created_by)
        VALUES (?, ?, ?, 0, ?)
      `, [
        result.lastID,
        item.label,
        dayjs(medicationStartDate).add(item.offset, "day").format("YYYY-MM-DD"),
        req.session.user.id
      ]);
    });

    return getPatientOr404(result.lastID);
  });

  const patient = createPatient();
  writeAudit(req, "创建患者", "patient", patient.research_id || patient.patient_id, `创建患者档案：${patient.research_id || patient.patient_id}`);
  res.status(201).json({ patient });
});

router.get("/:id", requirePatientAccess, (req, res) => {
  const id = Number(req.params.id);
  const patient = getPatientOr404(id);
  if (!patient) return res.status(404).json({ error: "患者不存在" });
  const safePatient = {
    ...patient,
    phone: undefined,
    phone_masked: maskPhone(patient.phone)
  };

  const schedules = all(`
    SELECT
      s.*,
      f.id AS followup_id,
      f.submitted_at,
      f.has_adverse_reaction,
      f.severity
    FROM followup_schedules s
    LEFT JOIN followups f ON f.schedule_id = s.id
    WHERE s.patient_id = ?
    ORDER BY s.due_date ASC, s.id ASC
  `, [id]);
  const followups = getPatientFollowups(id);
  const notes = all(`
    SELECT n.*, u.display_name AS doctor_name
    FROM doctor_notes n
    JOIN users u ON u.id = n.doctor_id
    WHERE n.patient_id = ?
    ORDER BY n.created_at DESC
  `, [id]);
  const evaluations = all(`
    SELECT e.*, u.display_name AS evaluator_name
    FROM clinician_evaluations e
    JOIN users u ON u.id = e.evaluator_doctor
    WHERE e.patient_id = ?
    ORDER BY e.evaluation_date DESC, e.id DESC
  `, [id]);

  res.json({
    patient: safePatient,
    schedules,
    followups,
    notes,
    evaluations,
    risks: computePatientRisks(patient, followups)
  });
});

router.get("/:id/followups", requirePatientAccess, (req, res) => {
  res.json({ followups: getPatientFollowups(Number(req.params.id)) });
});

router.put("/:id", requirePatientAccess, (req, res) => {
  const id = Number(req.params.id);
  const patient = getPatientOr404(id);
  if (!patient) return res.status(404).json({ error: "患者不存在" });

  const body = req.body || {};
  const name = String(body.name || patient.name).trim();
  const sex = String(body.sex || patient.sex).trim();
  const age = Number(body.age ?? patient.age);
  const phone = String(body.phone || "").trim();
  const diagnosis = String(body.diagnosis || patient.diagnosis).trim();
  const tcmSyndrome = String(body.tcm_syndrome || patient.tcm_syndrome).trim();
  const notes = String(body.notes === undefined ? patient.notes || "" : body.notes || "").trim();
  const consentSigned = body.consent_signed === undefined ? Number(patient.consent_signed) : parseBool(body.consent_signed);

  if (!name || !["男", "女", "其他"].includes(sex) || !Number.isInteger(age) || age < 0 || age > 120) {
    return res.status(400).json({ error: "请填写有效的姓名、性别和年龄" });
  }
  if (!diagnosis || !tcmSyndrome) {
    return res.status(400).json({ error: "请填写诊断和证型" });
  }

  run(`
    UPDATE patients
    SET name = ?,
        sex = ?,
        age = ?,
        phone = ?,
        diagnosis = ?,
        tcm_syndrome = ?,
        consent_signed = ?,
        consent_time = CASE
          WHEN ? = 1 AND consent_time IS NULL THEN datetime('now', 'localtime')
          WHEN ? = 0 THEN NULL
          ELSE consent_time
        END,
        notes = ?,
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `, [
    name,
    sex,
    age,
    phone,
    diagnosis,
    tcmSyndrome,
    consentSigned,
    consentSigned,
    consentSigned,
    notes,
    id
  ]);

  const updated = getPatientOr404(id);
  writeAudit(req, "修改患者信息", "patient", updated.research_id || updated.patient_id, `修改患者档案：${updated.research_id || updated.patient_id}`);
  res.json({ patient: { ...updated, phone: undefined, phone_masked: maskPhone(updated.phone) } });
});

router.post("/:id/schedules", requirePatientAccess, (req, res) => {
  const dueDate = String(req.body.due_date || "").trim();
  const label = String(req.body.label || "").trim() || `自定义随访 ${dueDate}`;

  if (!dayjs(dueDate).isValid()) {
    return res.status(400).json({ error: "随访日期无效" });
  }

  const result = run(`
    INSERT INTO followup_schedules (patient_id, label, due_date, is_custom, created_by)
    VALUES (?, ?, ?, 1, ?)
  `, [Number(req.params.id), label, dayjs(dueDate).format("YYYY-MM-DD"), req.session.user.id]);

  const schedule = get("SELECT * FROM followup_schedules WHERE id = ?", [result.lastID]);
  res.status(201).json({ schedule });
});

router.post("/:id/notes", requirePatientAccess, (req, res) => {
  const note = String(req.body.note || "").trim();
  if (!note) return res.status(400).json({ error: "备注不能为空" });

  const result = run(`
    INSERT INTO doctor_notes (patient_id, doctor_id, note)
    VALUES (?, ?, ?)
  `, [Number(req.params.id), req.session.user.id, note]);

  const created = get(`
    SELECT n.*, u.display_name AS doctor_name
    FROM doctor_notes n
    JOIN users u ON u.id = n.doctor_id
    WHERE n.id = ?
  `, [result.lastID]);

  const patient = getPatientOr404(Number(req.params.id));
  writeAudit(req, "医生备注", "patient", patient?.research_id || req.params.id, `新增医生备注：${note.slice(0, 60)}`);
  res.status(201).json({ note: created });
});

router.post("/:id/evaluations", requirePatientAccess, (req, res) => {
  const id = Number(req.params.id);
  const patient = getPatientOr404(id);
  if (!patient) return res.status(404).json({ error: "患者不存在" });

  const evaluationDate = String(req.body.evaluation_date || "").trim();
  const clinicianEffect = String(req.body.clinician_effect || "暂未评价").trim();
  const clinicianSafety = String(req.body.clinician_safety || "未见明显不良反应").trim();
  const clinicianNote = String(req.body.clinician_note || "").trim();
  const effects = ["显效", "有效", "无效", "加重", "暂未评价"];
  const safeties = ["未见明显不良反应", "轻度不良反应", "中度不良反应", "重度不良反应"];

  if (!dayjs(evaluationDate).isValid()) return res.status(400).json({ error: "评价日期无效" });
  if (!effects.includes(clinicianEffect)) return res.status(400).json({ error: "疗效评价无效" });
  if (!safeties.includes(clinicianSafety)) return res.status(400).json({ error: "安全性评价无效" });

  const result = run(`
    INSERT INTO clinician_evaluations (
      patient_id, evaluation_date, clinician_effect, clinician_safety, clinician_note, evaluator_doctor
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [
    id,
    dayjs(evaluationDate).format("YYYY-MM-DD"),
    clinicianEffect,
    clinicianSafety,
    clinicianNote,
    req.session.user.id
  ]);

  const evaluation = get(`
    SELECT e.*, u.display_name AS evaluator_name
    FROM clinician_evaluations e
    JOIN users u ON u.id = e.evaluator_doctor
    WHERE e.id = ?
  `, [result.lastID]);
  writeAudit(req, "医生疗效评价", "patient", patient.research_id || patient.patient_id, `${clinicianEffect} / ${clinicianSafety}`);
  res.status(201).json({ evaluation });
});

router.put("/:id/evaluations/:evaluationId", requirePatientAccess, (req, res) => {
  const patient = getPatientOr404(Number(req.params.id));
  if (!patient) return res.status(404).json({ error: "患者不存在" });
  const evaluation = get("SELECT * FROM clinician_evaluations WHERE id = ? AND patient_id = ?", [Number(req.params.evaluationId), patient.id]);
  if (!evaluation) return res.status(404).json({ error: "评价记录不存在" });

  const evaluationDate = String(req.body.evaluation_date || evaluation.evaluation_date).trim();
  const clinicianEffect = String(req.body.clinician_effect || evaluation.clinician_effect).trim();
  const clinicianSafety = String(req.body.clinician_safety || evaluation.clinician_safety).trim();
  const clinicianNote = String(req.body.clinician_note || "").trim();
  const effects = ["显效", "有效", "无效", "加重", "暂未评价"];
  const safeties = ["未见明显不良反应", "轻度不良反应", "中度不良反应", "重度不良反应"];

  if (!dayjs(evaluationDate).isValid()) return res.status(400).json({ error: "评价日期无效" });
  if (!effects.includes(clinicianEffect)) return res.status(400).json({ error: "疗效评价无效" });
  if (!safeties.includes(clinicianSafety)) return res.status(400).json({ error: "安全性评价无效" });

  run(`
    UPDATE clinician_evaluations
    SET evaluation_date = ?,
        clinician_effect = ?,
        clinician_safety = ?,
        clinician_note = ?,
        evaluator_doctor = ?,
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `, [
    dayjs(evaluationDate).format("YYYY-MM-DD"),
    clinicianEffect,
    clinicianSafety,
    clinicianNote,
    req.session.user.id,
    evaluation.id
  ]);

  const updated = get(`
    SELECT e.*, u.display_name AS evaluator_name
    FROM clinician_evaluations e
    JOIN users u ON u.id = e.evaluator_doctor
    WHERE e.id = ?
  `, [evaluation.id]);
  writeAudit(req, "修改医生疗效评价", "patient", patient.research_id || patient.patient_id, `${clinicianEffect} / ${clinicianSafety}`);
  res.json({ evaluation: updated });
});

router.get("/:id/qrcode", requirePatientAccess, async (req, res, next) => {
  try {
    const patient = getPatientOr404(Number(req.params.id));
    if (!patient) return res.status(404).json({ error: "患者不存在" });
    if (patient.token_disabled) {
      return res.json({
        disabled: true,
        link: "",
        dataUrl: "",
        message: "患者随访链接已禁用"
      });
    }
    const link = `${req.protocol}://${req.get("host")}/patient.html?token=${patient.token}`;
    const dataUrl = await QRCode.toDataURL(link, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: "M"
    });
    writeAudit(req, "二维码生成", "patient", patient.research_id || patient.patient_id, "生成患者专属随访二维码");
    res.json({ link, dataUrl });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/token", requirePatientAccess, (req, res) => {
  const patient = getPatientOr404(Number(req.params.id));
  if (!patient) return res.status(404).json({ error: "患者不存在" });

  const disabled = parseBool(req.body.disabled);
  run(`
    UPDATE patients
    SET token_disabled = ?,
        token_disabled_at = CASE WHEN ? = 1 THEN datetime('now', 'localtime') ELSE NULL END,
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `, [disabled, disabled, patient.id]);

  const updated = getPatientOr404(patient.id);
  writeAudit(req, disabled ? "禁用随访token" : "启用随访token", "patient", updated.research_id || updated.patient_id, disabled ? "患者随访链接已禁用" : "患者随访链接已启用");
  res.json({
    patient: {
      id: updated.id,
      patient_id: updated.patient_id,
      token_disabled: updated.token_disabled,
      token_disabled_at: updated.token_disabled_at
    }
  });
});

router.get("/:id/access-check", (req, res) => {
  res.json({ ok: canAccessPatient(req.session.user, Number(req.params.id)) });
});

module.exports = router;
