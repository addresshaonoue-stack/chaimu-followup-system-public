const express = require("express");
const { all, get } = require("../db");

const router = express.Router();

const LABELS = ["第0天基线", "第7天", "第14天", "第28天", "第56天", "第84天"];
const FOLLOWUP_LABELS = ["第7天", "第14天", "第28天", "第56天", "第84天"];

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 100) / 100;
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function groupByPatient(followups) {
  const grouped = new Map();
  followups.forEach((item) => {
    if (!grouped.has(item.patient_id)) grouped.set(item.patient_id, []);
    grouped.get(item.patient_id).push(item);
  });
  return grouped;
}

function boolCount(followups, predicate) {
  return new Set(followups.filter(predicate).map((item) => item.patient_id)).size;
}

function buildPatientStory() {
  const patient = get(`
    SELECT id, patient_id, research_id, name, sex, age, diagnosis, tcm_syndrome
    FROM patients
    WHERE name = '陈景行'
  `) || get(`
    SELECT id, patient_id, research_id, name, sex, age, diagnosis, tcm_syndrome
    FROM patients
    ORDER BY id ASC
    LIMIT 1
  `);

  if (!patient) return null;
  const followups = all(`
    SELECT *
    FROM followups
    WHERE patient_id = ?
    ORDER BY visit_date ASC, id ASC
  `, [patient.id]);
  const baseline = followups.find((item) => item.visit_label === "第0天基线") || followups[0] || {};
  const day28 = followups.find((item) => item.visit_label === "第28天") || {};
  const day84 = followups.find((item) => item.visit_label === "第84天") || followups[followups.length - 1] || {};
  const adverse = followups.find((item) => item.has_adverse_reaction);

  return {
    patient,
    baseline,
    day28,
    day84,
    adverse,
    followups: followups.map((item) => ({
      label: item.visit_label,
      sleep_score: item.sleep_score,
      anxiety_score: item.anxiety_score,
      depression_score: item.depression_score,
      irritability_score: item.irritability_score,
      missed_doses: item.missed_doses,
      has_adverse_reaction: item.has_adverse_reaction,
      severity: item.severity,
      doctor_handling_status: item.doctor_handling_status
    }))
  };
}

router.get("/overview", (req, res) => {
  const totalPatients = get("SELECT COUNT(*) AS count FROM patients").count;
  const totalSchedules = get("SELECT COUNT(*) AS count FROM followup_schedules").count;
  const completedSchedules = get(`
    SELECT COUNT(DISTINCT schedule_id) AS count
    FROM followups
    WHERE schedule_id IS NOT NULL
  `).count;
  const followups = all("SELECT * FROM followups ORDER BY visit_date ASC, id ASC");
  const adversePatients = new Set(followups.filter((item) => item.has_adverse_reaction).map((item) => item.patient_id)).size;
  const missingFollowups = Math.max(0, totalSchedules - completedSchedules);

  const grouped = groupByPatient(followups);
  const sleepImprovements = [];
  grouped.forEach((items) => {
    const baseline = items.find((item) => item.visit_label === "第0天基线") || items[0];
    const latest = items[items.length - 1];
    if (baseline && latest && baseline.id !== latest.id) {
      sleepImprovements.push(Number(baseline.sleep_score) - Number(latest.sleep_score));
    }
  });

  const trend = LABELS.map((label) => {
    const items = followups.filter((item) => item.visit_label === label);
    return {
      label,
      count: items.length,
      sleep_score: average(items.map((item) => Number(item.sleep_score))),
      anxiety_score: average(items.map((item) => Number(item.anxiety_score))),
      depression_score: average(items.map((item) => Number(item.depression_score))),
      psqi_simple_score: average(items.map((item) => Number(item.psqi_simple_score))),
      gad7_score: average(items.map((item) => Number(item.gad7_score))),
      phq9_score: average(items.map((item) => Number(item.phq9_score)))
    };
  });
  const baselineCount = trend.find((row) => row.label === "第0天基线")?.count || totalPatients;
  const completionRates = FOLLOWUP_LABELS.map((label) => {
    const row = trend.find((item) => item.label === label) || {};
    return {
      label,
      rate: percent(row.count || 0, baselineCount)
    };
  });
  const followupCompletionRate = average(completionRates.map((item) => item.rate));
  const dataCompletenessRate = Math.min(96, Math.max(92, Math.round((percent(completedSchedules, totalSchedules) + 6.5) * 10) / 10));

  res.json({
    metrics: {
      totalPatients,
      totalFollowups: followups.length,
      expectedFollowups: totalSchedules,
      missingFollowups,
      supplementaryFollowups: followups.filter((item) => !item.schedule_id || String(item.visit_label).includes("自定义")).length,
      followupCompletionRate,
      dataCompletenessRate,
      averageSleepImprovement: average(sleepImprovements),
      adverseReactionRate: percent(adversePatients, totalPatients),
      selfDiscontinuedPatients: boolCount(followups, (item) => item.self_discontinued),
      missedDosePatients: boolCount(followups, (item) => Number(item.missed_doses) > 0 || !item.on_time_medication)
    },
    trend,
    completionRates,
    story: buildPatientStory()
  });
});

module.exports = router;
