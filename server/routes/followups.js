const express = require("express");
const dayjs = require("dayjs");
const { all, get, run } = require("../db");
const { writeAudit } = require("../audit");
const {
  requireDoctorOrAdmin,
  canAccessPatient
} = require("../middleware");

const router = express.Router();

function parseBool(value) {
  return value === true || value === 1 || value === "1" || value === "true" || value === "on" ? 1 : 0;
}

function scoreValue(body, key) {
  const value = Number(body[key]);
  if (!Number.isFinite(value) || value < 0 || value > 10) {
    throw new Error(`${key} 评分需在0-10之间`);
  }
  return Math.round(value);
}

function optional03(body, key) {
  if (body[key] === undefined || body[key] === null || body[key] === "") return null;
  const value = Number(body[key]);
  if (!Number.isFinite(value) || value < 0 || value > 3) {
    throw new Error(`${key} 需在0-3之间`);
  }
  return Math.round(value);
}

function sumIfAny(values) {
  return values.some((value) => value !== null && value !== undefined)
    ? values.reduce((sum, value) => sum + Number(value || 0), 0)
    : null;
}

function gad7Level(score) {
  if (score === null || score === undefined) return "";
  if (score <= 4) return "正常或轻微";
  if (score <= 9) return "轻度";
  if (score <= 14) return "中度";
  return "重度";
}

function phq9Level(score) {
  if (score === null || score === undefined) return "";
  if (score <= 4) return "正常或轻微";
  if (score <= 9) return "轻度";
  if (score <= 14) return "中度";
  if (score <= 19) return "中重度";
  return "重度";
}

function adherenceLevel(score) {
  if (score === null || score === undefined) return "";
  if (score >= 4) return "高依从性";
  if (score >= 2) return "中等依从性";
  return "低依从性";
}

router.get("/patient/:token", (req, res) => {
  const patient = get(`
    SELECT
      p.id, p.patient_id, p.research_id, p.name, p.sex, p.age, p.diagnosis, p.tcm_syndrome, p.medication_start_date,
      p.consent_signed, p.consent_time, p.token_disabled,
      u.display_name AS doctor_name
    FROM patients p
    JOIN users u ON u.id = p.doctor_id
    WHERE p.token = ?
  `, [req.params.token]);

  if (!patient) return res.status(404).json({ error: "随访链接无效" });
  if (patient.token_disabled) {
    return res.status(410).json({ error: "随访链接已失效，请联系管理医生" });
  }

  const schedules = all(`
    SELECT
      s.id, s.label, s.due_date, s.is_custom,
      f.id AS followup_id, f.submitted_at
    FROM followup_schedules s
    LEFT JOIN followups f ON f.schedule_id = s.id
    WHERE s.patient_id = ?
    ORDER BY s.due_date ASC, s.id ASC
  `, [patient.id]);

  res.json({
    patient: {
      patient_id: patient.patient_id,
      research_id: patient.research_id,
      name: patient.name,
      diagnosis: patient.diagnosis,
      tcm_syndrome: patient.tcm_syndrome,
      medication_start_date: patient.medication_start_date,
      doctor_name: patient.doctor_name,
      consent_signed: patient.consent_signed,
      consent_time: patient.consent_time
    },
    schedules
  });
});

router.post("/patient/:token", (req, res) => {
  const patient = get("SELECT id, patient_id, research_id, consent_signed, token_disabled FROM patients WHERE token = ?", [req.params.token]);
  if (!patient) return res.status(404).json({ error: "随访链接无效" });
  if (patient.token_disabled) {
    return res.status(410).json({ error: "随访链接已失效，请联系管理医生" });
  }
  if (!patient.consent_signed && !parseBool(req.body.consent_confirmed)) {
    return res.status(400).json({ error: "首次填写随访前需确认知情同意提示" });
  }

  let schedule = null;
  if (req.body.schedule_id) {
    schedule = get(`
      SELECT s.*, f.id AS followup_id
      FROM followup_schedules s
      LEFT JOIN followups f ON f.schedule_id = s.id
      WHERE s.id = ? AND s.patient_id = ?
    `, [Number(req.body.schedule_id), patient.id]);
    if (!schedule) return res.status(400).json({ error: "随访节点无效" });
    if (schedule.followup_id) return res.status(409).json({ error: "该随访节点已提交" });
  }

  try {
    const visitDate = req.body.visit_date && dayjs(req.body.visit_date).isValid()
      ? dayjs(req.body.visit_date).format("YYYY-MM-DD")
      : dayjs().format("YYYY-MM-DD");
    const visitLabel = schedule ? schedule.label : `自定义随访 ${visitDate}`;
    const psqiItems = [
      optional03(req.body, "psqi_sleep_latency"),
      optional03(req.body, "psqi_night_wake"),
      optional03(req.body, "psqi_early_wake"),
      optional03(req.body, "psqi_sleep_duration"),
      optional03(req.body, "psqi_day_fatigue")
    ];
    const gad7Items = [1, 2, 3, 4, 5, 6, 7].map((index) => optional03(req.body, `gad7_${index}`));
    const phq9Items = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => optional03(req.body, `phq9_${index}`));
    const psqiScore = sumIfAny(psqiItems);
    const gad7Score = sumIfAny(gad7Items);
    const phq9Score = sumIfAny(phq9Items);
    const adherenceForget = parseBool(req.body.adherence_forget);
    const adherenceStopBetter = parseBool(req.body.adherence_stop_better);
    const adherenceStopDiscomfort = parseBool(req.body.adherence_stop_discomfort);
    const adherenceRegular = parseBool(req.body.adherence_regular);
    const adherenceScore = (adherenceForget ? 0 : 1)
      + (adherenceStopBetter ? 0 : 1)
      + (adherenceStopDiscomfort ? 0 : 1)
      + (adherenceRegular ? 1 : 0);

    const params = {
      patient_id: patient.id,
      schedule_id: schedule ? schedule.id : null,
      visit_label: visitLabel,
      visit_date: visitDate,
      on_time_medication: parseBool(req.body.on_time_medication),
      missed_doses: Math.max(0, Number(req.body.missed_doses || 0)),
      self_discontinued: parseBool(req.body.self_discontinued),
      sleep_score: scoreValue(req.body, "sleep_score"),
      sleep_difficulty: parseBool(req.body.sleep_difficulty),
      early_wake: parseBool(req.body.early_wake),
      vivid_dreams: parseBool(req.body.vivid_dreams),
      sleep_hours: req.body.sleep_hours === "" ? null : Number(req.body.sleep_hours || 0),
      psqi_sleep_latency: psqiItems[0],
      psqi_night_wake: psqiItems[1],
      psqi_early_wake: psqiItems[2],
      psqi_sleep_duration: psqiItems[3],
      psqi_day_fatigue: psqiItems[4],
      psqi_simple_score: psqiScore,
      anxiety_score: scoreValue(req.body, "anxiety_score"),
      depression_score: scoreValue(req.body, "depression_score"),
      irritability_score: scoreValue(req.body, "irritability_score"),
      low_mood_score: scoreValue(req.body, "low_mood_score"),
      gad7_1: gad7Items[0],
      gad7_2: gad7Items[1],
      gad7_3: gad7Items[2],
      gad7_4: gad7Items[3],
      gad7_5: gad7Items[4],
      gad7_6: gad7Items[5],
      gad7_7: gad7Items[6],
      gad7_score: gad7Score,
      gad7_level: gad7Level(gad7Score),
      phq9_1: phq9Items[0],
      phq9_2: phq9Items[1],
      phq9_3: phq9Items[2],
      phq9_4: phq9Items[3],
      phq9_5: phq9Items[4],
      phq9_6: phq9Items[5],
      phq9_7: phq9Items[6],
      phq9_8: phq9Items[7],
      phq9_9: phq9Items[8],
      phq9_score: phq9Score,
      phq9_level: phq9Level(phq9Score),
      chest_tightness: scoreValue(req.body, "chest_tightness"),
      palpitation: scoreValue(req.body, "palpitation"),
      dizziness: scoreValue(req.body, "dizziness"),
      bitter_mouth: scoreValue(req.body, "bitter_mouth"),
      dry_mouth: scoreValue(req.body, "dry_mouth"),
      fatigue: scoreValue(req.body, "fatigue"),
      adherence_forget: adherenceForget,
      adherence_stop_better: adherenceStopBetter,
      adherence_stop_discomfort: adherenceStopDiscomfort,
      adherence_regular: adherenceRegular,
      adherence_score: adherenceScore,
      adherence_level: adherenceLevel(adherenceScore),
      has_adverse_reaction: parseBool(req.body.has_adverse_reaction),
      adverse_type: String(req.body.adverse_type || "").trim(),
      severity: req.body.severity ? String(req.body.severity) : null,
      stopped_due_adverse: parseBool(req.body.stopped_due_adverse),
      sought_medical_help: parseBool(req.body.sought_medical_help),
      adverse_description: String(req.body.adverse_description || "").trim(),
      patient_note: String(req.body.patient_note || "").trim()
    };

    if (!params.has_adverse_reaction) {
      params.adverse_type = "";
      params.severity = null;
      params.stopped_due_adverse = 0;
      params.sought_medical_help = 0;
      params.adverse_description = "";
    } else if (!["轻", "中", "重"].includes(params.severity)) {
      return res.status(400).json({ error: "请选择不良反应严重程度" });
    }

    const result = run(`
      INSERT INTO followups (
        patient_id, schedule_id, visit_label, visit_date,
        on_time_medication, missed_doses, self_discontinued,
      sleep_score, sleep_difficulty, early_wake, vivid_dreams, sleep_hours,
      psqi_sleep_latency, psqi_night_wake, psqi_early_wake, psqi_sleep_duration,
      psqi_day_fatigue, psqi_simple_score,
      anxiety_score, depression_score, irritability_score, low_mood_score,
      gad7_1, gad7_2, gad7_3, gad7_4, gad7_5, gad7_6, gad7_7, gad7_score, gad7_level,
      phq9_1, phq9_2, phq9_3, phq9_4, phq9_5, phq9_6, phq9_7, phq9_8, phq9_9, phq9_score, phq9_level,
      chest_tightness, palpitation, dizziness, bitter_mouth, dry_mouth, fatigue,
      adherence_forget, adherence_stop_better, adherence_stop_discomfort, adherence_regular,
      adherence_score, adherence_level,
      has_adverse_reaction, adverse_type, severity, stopped_due_adverse,
        sought_medical_help, adverse_description, patient_note
      ) VALUES (
        @patient_id, @schedule_id, @visit_label, @visit_date,
        @on_time_medication, @missed_doses, @self_discontinued,
      @sleep_score, @sleep_difficulty, @early_wake, @vivid_dreams, @sleep_hours,
      @psqi_sleep_latency, @psqi_night_wake, @psqi_early_wake, @psqi_sleep_duration,
      @psqi_day_fatigue, @psqi_simple_score,
      @anxiety_score, @depression_score, @irritability_score, @low_mood_score,
      @gad7_1, @gad7_2, @gad7_3, @gad7_4, @gad7_5, @gad7_6, @gad7_7, @gad7_score, @gad7_level,
      @phq9_1, @phq9_2, @phq9_3, @phq9_4, @phq9_5, @phq9_6, @phq9_7, @phq9_8, @phq9_9, @phq9_score, @phq9_level,
      @chest_tightness, @palpitation, @dizziness, @bitter_mouth, @dry_mouth, @fatigue,
      @adherence_forget, @adherence_stop_better, @adherence_stop_discomfort, @adherence_regular,
      @adherence_score, @adherence_level,
      @has_adverse_reaction, @adverse_type, @severity, @stopped_due_adverse,
        @sought_medical_help, @adverse_description, @patient_note
      )
    `, params);

    const followup = get("SELECT * FROM followups WHERE id = ?", [result.lastID]);
    if (!patient.consent_signed && parseBool(req.body.consent_confirmed)) {
      run(`
        UPDATE patients
        SET consent_signed = 1,
            consent_time = datetime('now', 'localtime'),
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [patient.id]);
    }
    writeAudit(req, "提交随访", "followup", followup.id, `${patient.research_id || patient.patient_id} ${visitLabel}`, {
      actor_id: null,
      actor_name: patient.research_id || patient.patient_id,
      actor_role: "patient"
    });
    res.status(201).json({ followup });
  } catch (error) {
    res.status(400).json({ error: error.message || "随访提交失败" });
  }
});

router.put("/:id/doctor", requireDoctorOrAdmin, (req, res) => {
  const followup = get("SELECT * FROM followups WHERE id = ?", [Number(req.params.id)]);
  if (!followup) return res.status(404).json({ error: "随访记录不存在" });
  if (!canAccessPatient(req.session.user, followup.patient_id)) {
    return res.status(403).json({ error: "无权处理该随访记录" });
  }

  const status = String(req.body.doctor_handling_status || followup.doctor_handling_status || "未处理").trim();
  const allowed = ["未处理", "处理中", "已处理", "无需处理"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "处理状态无效" });
  }

  run(`
    UPDATE followups
    SET
      doctor_note = ?,
      doctor_handling_status = ?,
      doctor_handling_note = ?,
      handled_by = ?,
      handled_at = datetime('now', 'localtime')
    WHERE id = ?
  `, [
    String(req.body.doctor_note || "").trim(),
    status,
    String(req.body.doctor_handling_note || "").trim(),
    req.session.user.id,
    followup.id
  ]);

  const updated = get("SELECT * FROM followups WHERE id = ?", [followup.id]);
  const patient = get("SELECT research_id, patient_id FROM patients WHERE id = ?", [followup.patient_id]);
  writeAudit(req, "不良反应处理", "followup", followup.id, `${patient?.research_id || patient?.patient_id || followup.patient_id} ${status}`);
  res.json({ followup: updated });
});

module.exports = router;
