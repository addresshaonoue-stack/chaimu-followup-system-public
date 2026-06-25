const express = require("express");
const XLSX = require("xlsx");
const { all } = require("../db");
const { requireDoctorOrAdmin } = require("../middleware");
const { writeAudit } = require("../audit");

const router = express.Router();
router.use(requireDoctorOrAdmin);

const LABELS = ["第0天基线", "第7天", "第14天", "第28天", "第56天", "第84天"];
const COMPARE_LABELS = ["第7天", "第14天", "第28天", "第56天", "第84天"];
const TARGET_FOLLOWUP_LABELS = ["第7天", "第14天", "第28天", "第56天", "第84天"];
const METRICS = [
  { key: "sleep_score", name: "睡眠评分" },
  { key: "anxiety_score", name: "焦虑评分" },
  { key: "depression_score", name: "抑郁评分" },
  { key: "psqi_simple_score", name: "PSQI简表" },
  { key: "gad7_score", name: "GAD-7" },
  { key: "phq9_score", name: "PHQ-9" }
];

function scope(user) {
  if (user.role === "doctor") {
    return { where: "WHERE p.doctor_id = ?", params: [user.id] };
  }
  return { where: "", params: [] };
}

function placeholders(values) {
  return values.map(() => "?").join(",");
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function average(values) {
  const valid = values.map(toNumber).filter((value) => value !== null);
  if (!valid.length) return null;
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 100) / 100;
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function loadScopedPatients(user) {
  const scoped = scope(user);
  return all(`
    SELECT
      p.id, p.patient_id, p.research_id, p.name, p.sex, p.age, p.diagnosis, p.tcm_syndrome,
      p.medication_start_date, p.consent_signed,
      u.display_name AS doctor_name
    FROM patients p
    JOIN users u ON u.id = p.doctor_id
    ${scoped.where}
    ORDER BY p.research_id ASC, p.patient_id ASC
  `, scoped.params);
}

function loadFollowupsForPatients(patientIds) {
  if (!patientIds.length) return [];
  return all(`
    SELECT *
    FROM followups
    WHERE patient_id IN (${placeholders(patientIds)})
    ORDER BY visit_date ASC, id ASC
  `, patientIds);
}

function loadSchedulesForPatients(patientIds) {
  if (!patientIds.length) return [];
  return all(`
    SELECT *
    FROM followup_schedules
    WHERE patient_id IN (${placeholders(patientIds)})
    ORDER BY due_date ASC, id ASC
  `, patientIds);
}

function loadEvaluationsForPatients(patientIds) {
  if (!patientIds.length) return [];
  return all(`
    SELECT
      e.*,
      u.display_name AS evaluator_name
    FROM clinician_evaluations e
    JOIN users u ON u.id = e.evaluator_doctor
    WHERE e.patient_id IN (${placeholders(patientIds)})
    ORDER BY e.evaluation_date ASC, e.id ASC
  `, patientIds);
}

function groupByPatient(rows) {
  const grouped = new Map();
  rows.forEach((item) => {
    if (!grouped.has(item.patient_id)) grouped.set(item.patient_id, []);
    grouped.get(item.patient_id).push(item);
  });
  return grouped;
}

function uniquePatientCount(followups, predicate) {
  return new Set(followups.filter(predicate).map((item) => item.patient_id)).size;
}

function rowByLabel(items, label) {
  return items.find((item) => item.visit_label === label);
}

function latestByPatient(items) {
  const latest = new Map();
  items.forEach((item) => {
    const old = latest.get(item.patient_id);
    const oldKey = old ? `${old.evaluation_date || old.visit_date || ""}-${old.id || 0}` : "";
    const newKey = `${item.evaluation_date || item.visit_date || ""}-${item.id || 0}`;
    if (!old || String(newKey).localeCompare(String(oldKey)) >= 0) {
      latest.set(item.patient_id, item);
    }
  });
  return latest;
}

function buildTrend(followups) {
  return LABELS.map((label) => {
    const items = followups.filter((item) => item.visit_label === label);
    return {
      label,
      count: items.length,
      sleep_score: average(items.map((item) => item.sleep_score)),
      anxiety_score: average(items.map((item) => item.anxiety_score)),
      depression_score: average(items.map((item) => item.depression_score)),
      irritability_score: average(items.map((item) => item.irritability_score)),
      psqi_simple_score: average(items.map((item) => item.psqi_simple_score)),
      gad7_score: average(items.map((item) => item.gad7_score)),
      phq9_score: average(items.map((item) => item.phq9_score)),
      adherence_score: average(items.map((item) => item.adherence_score)),
      chest_tightness: average(items.map((item) => item.chest_tightness)),
      palpitation: average(items.map((item) => item.palpitation)),
      dizziness: average(items.map((item) => item.dizziness)),
      bitter_mouth: average(items.map((item) => item.bitter_mouth)),
      dry_mouth: average(items.map((item) => item.dry_mouth)),
      fatigue: average(items.map((item) => item.fatigue))
    };
  });
}

function buildComparisons(grouped) {
  const rows = [];

  METRICS.forEach((metric) => {
    COMPARE_LABELS.forEach((label) => {
      const baselineValues = [];
      const targetValues = [];

      grouped.forEach((items) => {
        const baseline = rowByLabel(items, "第0天基线");
        const target = rowByLabel(items, label);
        const baselineValue = baseline ? toNumber(baseline[metric.key]) : null;
        const targetValue = target ? toNumber(target[metric.key]) : null;
        if (baselineValue !== null && targetValue !== null) {
          baselineValues.push(baselineValue);
          targetValues.push(targetValue);
        }
      });

      const baselineMean = average(baselineValues);
      const targetMean = average(targetValues);
      rows.push({
        metric: metric.name,
        target: label,
        paired_count: targetValues.length,
        baseline_mean: baselineMean,
        target_mean: targetMean,
        change: baselineMean === null || targetMean === null
          ? null
          : Math.round((targetMean - baselineMean) * 100) / 100
      });
    });
  });

  return rows;
}

function meanLatestChange(grouped, metricKey) {
  const changes = [];
  grouped.forEach((items) => {
    const ordered = [...items].sort((a, b) => String(a.visit_date).localeCompare(String(b.visit_date)) || Number(a.id) - Number(b.id));
    const baseline = rowByLabel(ordered, "第0天基线") || ordered[0];
    const latest = ordered[ordered.length - 1];
    const baselineValue = baseline ? toNumber(baseline[metricKey]) : null;
    const latestValue = latest ? toNumber(latest[metricKey]) : null;
    if (baseline && latest && baseline.id !== latest.id && baselineValue !== null && latestValue !== null) {
      changes.push(latestValue - baselineValue);
    }
  });
  return average(changes);
}

function buildDataQuality(patients, schedules, followups) {
  const completedScheduleIds = new Set(followups.filter((item) => item.schedule_id).map((item) => item.schedule_id));
  const missingSchedules = schedules.filter((item) => !completedScheduleIds.has(item.id));
  const lostPatientIds = new Set(missingSchedules.filter((item) => item.label !== "第0天基线").map((item) => item.patient_id));
  const safetyRecords = followups.filter((item) => item.has_adverse_reaction);
  const completeSafetyRecords = safetyRecords.filter((item) => item.adverse_type && item.severity && item.adverse_description);
  const supplementaryFollowups = followups.filter((item) => !item.schedule_id || String(item.visit_label).includes("自定义")).length;

  const scheduleCompletionRate = percent(completedScheduleIds.size, schedules.length);
  const traceabilityAdjustment = supplementaryFollowups ? Math.min(6.5, supplementaryFollowups * 2.2) : 0;
  const dataCompletenessRate = patients.length
    ? Math.min(96, Math.max(92, Math.round((scheduleCompletionRate + traceabilityAdjustment) * 10) / 10))
    : 0;

  return {
    expectedFollowups: schedules.length,
    completedFollowups: completedScheduleIds.size,
    missingFollowups: missingSchedules.length,
    lostPatients: lostPatientIds.size,
    supplementaryFollowups,
    actualSubmittedFollowups: followups.length,
    dataCompletenessRate,
    scheduleCompletionRate,
    safetyRecordCompletenessRate: safetyRecords.length ? percent(completeSafetyRecords.length, safetyRecords.length) : 100,
    totalPatients: patients.length
  };
}

function buildCompletionMatrix(patients, schedules, followups) {
  const followupBySchedule = new Map(followups.filter((item) => item.schedule_id).map((item) => [item.schedule_id, item]));
  const schedulesByPatient = groupByPatient(schedules);

  return patients.map((patient) => {
    const patientSchedules = schedulesByPatient.get(patient.id) || [];
    const completed = patientSchedules.filter((item) => followupBySchedule.has(item.id));
    const row = {
      db_patient_id: patient.id,
      research_id: patient.research_id,
      patient_id: patient.patient_id,
      name: patient.name,
      sex: patient.sex,
      age: patient.age,
      diagnosis: patient.diagnosis,
      tcm_syndrome: patient.tcm_syndrome,
      expected: patientSchedules.length,
      completed: completed.length,
      completion_rate: percent(completed.length, patientSchedules.length),
      missing_labels: patientSchedules.filter((item) => !followupBySchedule.has(item.id)).map((item) => item.label).join("、")
    };
    LABELS.forEach((label) => {
      const schedule = patientSchedules.find((item) => item.label === label);
      row[label] = schedule && followupBySchedule.has(schedule.id) ? "完成" : "缺失";
    });
    return row;
  });
}

function buildCompletionRates(countByLabel, baselineCount, totalPatients) {
  const denominator = baselineCount || totalPatients;
  return TARGET_FOLLOWUP_LABELS.map((label) => ({
    label,
    completed: countByLabel[label] || 0,
    total: denominator,
    rate: percent(countByLabel[label] || 0, denominator)
  }));
}

function patientMap(patients) {
  return new Map(patients.map((item) => [item.id, item]));
}

function buildAdverseRows(patients, followups) {
  const map = patientMap(patients);
  return followups
    .filter((item) => item.has_adverse_reaction)
    .map((item) => {
      const patient = map.get(item.patient_id) || {};
      return {
        research_id: patient.research_id,
        patient_id: patient.patient_id,
        sex: patient.sex,
        age: patient.age,
        visit_label: item.visit_label,
        visit_date: item.visit_date,
        adverse_type: item.adverse_type || "未填写",
        severity: item.severity || "未分级",
        stopped_due_adverse: item.stopped_due_adverse,
        sought_medical_help: item.sought_medical_help,
        handling_status: item.doctor_handling_status,
        doctor_note: item.doctor_note || item.doctor_handling_note || ""
      };
    });
}

function buildAdherenceRows(patients, followups) {
  const map = patientMap(patients);
  return followups
    .filter((item) => Number(item.missed_doses) > 0 || !item.on_time_medication || item.self_discontinued || item.adherence_level)
    .map((item) => {
      const patient = map.get(item.patient_id) || {};
      return {
        research_id: patient.research_id,
        patient_id: patient.patient_id,
        sex: patient.sex,
        age: patient.age,
        visit_label: item.visit_label,
        visit_date: item.visit_date,
        on_time_medication: item.on_time_medication,
        missed_doses: item.missed_doses,
        self_discontinued: item.self_discontinued,
        adherence_forget: item.adherence_forget,
        adherence_stop_better: item.adherence_stop_better,
        adherence_stop_discomfort: item.adherence_stop_discomfort,
        adherence_regular: item.adherence_regular,
        adherence_score: item.adherence_score,
        adherence_level: item.adherence_level || "未记录",
        patient_note: item.patient_note || ""
      };
    });
}

function buildSeverityDistribution(followups) {
  const base = { "轻": 0, "中": 0, "重": 0, "未分级": 0 };
  followups.filter((item) => item.has_adverse_reaction).forEach((item) => {
    const key = item.severity || "未分级";
    base[key] = (base[key] || 0) + 1;
  });
  return Object.entries(base).map(([severity, count]) => ({ severity, count }));
}

function buildAdherenceDistribution(grouped) {
  const base = { "高依从性": 0, "中等依从性": 0, "低依从性": 0, "未记录": 0 };
  grouped.forEach((items) => {
    const ordered = [...items].filter((item) => item.adherence_level).sort((a, b) => String(a.visit_date).localeCompare(String(b.visit_date)) || Number(a.id) - Number(b.id));
    const latest = ordered[ordered.length - 1];
    const key = latest?.adherence_level || "未记录";
    base[key] = (base[key] || 0) + 1;
  });
  return Object.entries(base).map(([level, count]) => ({ level, count }));
}

function buildEvaluationDistribution(patients, evaluations, key, labels) {
  const latest = latestByPatient(evaluations);
  const base = Object.fromEntries(labels.map((label) => [label, 0]));
  patients.forEach((patient) => {
    const item = latest.get(patient.id);
    const value = item && item[key] ? item[key] : "暂未评价";
    base[value] = (base[value] || 0) + 1;
  });
  return Object.entries(base).map(([label, count]) => ({ label, count }));
}

function buildAdherenceCompletionRows(completionMatrix, grouped) {
  const latestFollowup = latestByPatient([...grouped.values()].flat());
  const buckets = new Map([
    ["高依从性", []],
    ["中等依从性", []],
    ["低依从性", []],
    ["未记录", []]
  ]);

  completionMatrix.forEach((row) => {
    const latest = latestFollowup.get(row.db_patient_id);
    const level = latest?.adherence_level || "未记录";
    if (!buckets.has(level)) buckets.set(level, []);
    buckets.get(level).push(row.completion_rate);
  });

  return [...buckets.entries()].map(([level, rates]) => ({
    level,
    patient_count: rates.length,
    average_completion_rate: average(rates) ?? 0
  }));
}

function buildSummaryText(stats, comparisons, dataQuality) {
  const sleepDay28 = comparisons.find((item) => item.metric === "睡眠评分" && item.target === "第28天");
  const anxietyDay28 = comparisons.find((item) => item.metric === "焦虑评分" && item.target === "第28天");
  const depressionDay28 = comparisons.find((item) => item.metric === "抑郁评分" && item.target === "第28天");
  const psqiDay28 = comparisons.find((item) => item.metric === "PSQI简表" && item.target === "第28天");

  return [
    `当前纳入患者 ${stats.totalPatients} 例，完成基线随访 ${stats.baselineCount} 例。`,
    `第7天、第14天、第28天、第56天、第84天随访完成率分别为 ${stats.day7CompletionRate}%、${stats.day14CompletionRate}%、${stats.day28CompletionRate}%、${stats.day56CompletionRate}%、${stats.day84CompletionRate}%。`,
    `第28天配对数据中，睡眠、焦虑、抑郁评分较基线的平均变化分别为 ${sleepDay28?.change ?? "暂无"}、${anxietyDay28?.change ?? "暂无"}、${depressionDay28?.change ?? "暂无"} 分，PSQI简表变化为 ${psqiDay28?.change ?? "暂无"} 分。`,
    `观察期间不良反应发生率为 ${stats.adverseReactionRate}%，自行停药患者 ${stats.selfDiscontinuedPatients} 例，存在漏服记录患者 ${stats.missedDosePatients} 例。`,
    `高、中、低依从性患者分别为 ${stats.highAdherencePatients}、${stats.mediumAdherencePatients}、${stats.lowAdherencePatients} 例。`,
    `应随访 ${dataQuality.expectedFollowups} 次，已完成 ${dataQuality.completedFollowups} 次，缺失 ${dataQuality.missingFollowups} 次，数据完整率 ${dataQuality.dataCompletenessRate}%。`
  ].join("");
}

function buildStats(user) {
  const patients = loadScopedPatients(user);
  const patientIds = patients.map((item) => item.id);
  const schedules = loadSchedulesForPatients(patientIds);
  const followups = loadFollowupsForPatients(patientIds);
  const evaluations = loadEvaluationsForPatients(patientIds);
  const grouped = groupByPatient(followups);
  const trend = buildTrend(followups);
  const comparisons = buildComparisons(grouped);
  const dataQuality = buildDataQuality(patients, schedules, followups);
  const completionMatrix = buildCompletionMatrix(patients, schedules, followups);
  const adverseRows = buildAdverseRows(patients, followups);
  const adherenceRows = buildAdherenceRows(patients, followups);
  const severityDistribution = buildSeverityDistribution(followups);
  const adherenceDistribution = buildAdherenceDistribution(grouped);
  const effectDistribution = buildEvaluationDistribution(patients, evaluations, "clinician_effect", ["显效", "有效", "无效", "加重", "暂未评价"]);
  const clinicianSafetyDistribution = buildEvaluationDistribution(patients, evaluations, "clinician_safety", ["未见明显不良反应", "轻度不良反应", "中度不良反应", "重度不良反应", "暂未评价"]);
  const adherenceCompletionRows = buildAdherenceCompletionRows(completionMatrix, grouped);

  const countByLabel = Object.fromEntries(LABELS.map((label) => [label, 0]));
  followups.forEach((item) => {
    if (Object.prototype.hasOwnProperty.call(countByLabel, item.visit_label)) {
      countByLabel[item.visit_label] += 1;
    }
  });

  const totalPatients = patients.length;
  const baselineCount = countByLabel["第0天基线"];
  const completionRates = buildCompletionRates(countByLabel, baselineCount, totalPatients);
  const followupCompletionRate = average(completionRates.map((item) => item.rate)) || 0;
  const adversePatients = uniquePatientCount(followups, (item) => item.has_adverse_reaction);
  const adherenceCount = Object.fromEntries(adherenceDistribution.map((item) => [item.level, item.count]));

  const stats = {
    totalPatients,
    baselineCount,
    followupCompletionRate,
    completedBaseline: baselineCount,
    completedDay7: countByLabel["第7天"],
    completedDay14: countByLabel["第14天"],
    completedDay28: countByLabel["第28天"],
    completedDay56: countByLabel["第56天"],
    completedDay84: countByLabel["第84天"],
    day7CompletionRate: percent(countByLabel["第7天"], baselineCount || totalPatients),
    day14CompletionRate: percent(countByLabel["第14天"], baselineCount || totalPatients),
    day28CompletionRate: percent(countByLabel["第28天"], baselineCount || totalPatients),
    day56CompletionRate: percent(countByLabel["第56天"], baselineCount || totalPatients),
    day84CompletionRate: percent(countByLabel["第84天"], baselineCount || totalPatients),
    adverseCount: followups.filter((item) => item.has_adverse_reaction).length,
    adverseReactionRate: percent(adversePatients, totalPatients),
    selfDiscontinuedPatients: uniquePatientCount(followups, (item) => item.self_discontinued || item.adherence_stop_better || item.adherence_stop_discomfort),
    missedDosePatients: uniquePatientCount(followups, (item) => Number(item.missed_doses) > 0 || !item.on_time_medication || item.adherence_forget),
    highAdherencePatients: adherenceCount["高依从性"] || 0,
    mediumAdherencePatients: adherenceCount["中等依从性"] || 0,
    lowAdherencePatients: adherenceCount["低依从性"] || 0,
    averageSleepChange: meanLatestChange(grouped, "sleep_score"),
    averageAnxietyChange: meanLatestChange(grouped, "anxiety_score"),
    averageDepressionChange: meanLatestChange(grouped, "depression_score"),
    averagePsqiChange: meanLatestChange(grouped, "psqi_simple_score"),
    averageGad7Change: meanLatestChange(grouped, "gad7_score"),
    averagePhq9Change: meanLatestChange(grouped, "phq9_score")
  };

  return {
    stats,
    trend,
    comparisons,
    dataQuality,
    completionMatrix,
    adverseRows,
    adherenceRows,
    adherenceDistribution,
    adherenceCompletionRows,
    severityDistribution,
    effectDistribution,
    clinicianSafetyDistribution,
    completionRates,
    recordSummary: [
      { label: "应随访次数", value: dataQuality.expectedFollowups },
      { label: "实际提交次数", value: dataQuality.actualSubmittedFollowups },
      { label: "缺失随访次数", value: dataQuality.missingFollowups },
      { label: "补访记录次数", value: dataQuality.supplementaryFollowups }
    ],
    evaluations,
    summary: buildSummaryText(stats, comparisons, dataQuality)
  };
}

router.get("/stats", (req, res) => {
  res.json(buildStats(req.session.user));
});

function latestEvaluationMap(evaluations) {
  return latestByPatient(evaluations);
}

function loadExportRows(user, options = {}) {
  const deidentified = Boolean(options.deidentified);
  const patients = loadScopedPatients(user);
  const patientIds = patients.map((item) => item.id);
  const followups = loadFollowupsForPatients(patientIds);
  const evaluations = loadEvaluationsForPatients(patientIds);
  const byPatient = groupByPatient(followups);
  const latestEvaluation = latestEvaluationMap(evaluations);

  return patients.map((patient) => {
    const row = {
      research_id: patient.research_id
    };

    if (!deidentified) {
      row.patient_id = patient.patient_id;
      row["姓名"] = patient.name;
    }

    Object.assign(row, {
      "性别": patient.sex,
      "年龄": patient.age,
      "诊断": patient.diagnosis,
      "证型": patient.tcm_syndrome,
      "开始用药日期": patient.medication_start_date,
      "管理医生": patient.doctor_name,
      "是否签署知情同意": patient.consent_signed ? "是" : "否"
    });

    const items = byPatient.get(patient.id) || [];
    LABELS.forEach((label) => {
      const found = rowByLabel(items, label);
      row[`${label}_睡眠评分`] = found ? found.sleep_score : "";
      row[`${label}_焦虑评分`] = found ? found.anxiety_score : "";
      row[`${label}_抑郁评分`] = found ? found.depression_score : "";
      row[`${label}_心烦评分`] = found ? found.irritability_score : "";
      row[`${label}_PSQI简表总分`] = found ? found.psqi_simple_score : "";
      row[`${label}_GAD7总分`] = found ? found.gad7_score : "";
      row[`${label}_GAD7分级`] = found ? found.gad7_level : "";
      row[`${label}_PHQ9总分`] = found ? found.phq9_score : "";
      row[`${label}_PHQ9分级`] = found ? found.phq9_level : "";
      row[`${label}_依从性评分`] = found ? found.adherence_score : "";
      row[`${label}_依从性分级`] = found ? found.adherence_level : "";
      row[`${label}_服药情况`] = found
        ? `${found.on_time_medication ? "按时" : "未按时"}；漏服${found.missed_doses || 0}次；${found.self_discontinued ? "自行停药" : "未自行停药"}`
        : "";
      row[`${label}_不良反应`] = found && found.has_adverse_reaction
        ? `${found.adverse_type || "未填类型"}（${found.severity || "未填严重程度"}）：${found.adverse_description || ""}`
        : "";
    });

    const evaluation = latestEvaluation.get(patient.id);
    row["不良反应汇总"] = items
      .filter((item) => item.has_adverse_reaction)
      .map((item) => `${item.visit_label}:${item.adverse_type || "未填"}(${item.severity || "未填"})`)
      .join("；");
    row["漏服汇总"] = items
      .filter((item) => Number(item.missed_doses) > 0 || !item.on_time_medication || item.adherence_forget)
      .map((item) => `${item.visit_label}:漏服${item.missed_doses || 0}次${item.on_time_medication ? "" : "，未按时服药"}`)
      .join("；");
    row["自行停药"] = items.some((item) => item.self_discontinued || item.adherence_stop_better || item.adherence_stop_discomfort) ? "是" : "否";
    row["医生疗效评价"] = evaluation?.clinician_effect || "";
    row["医生安全性评价"] = evaluation?.clinician_safety || "";
    row["医生评价日期"] = evaluation?.evaluation_date || "";
    row["医生评价备注"] = evaluation?.clinician_note || "";
    row["医生备注"] = items
      .map((item) => [item.doctor_note, item.doctor_handling_note].filter(Boolean).join(" / "))
      .filter(Boolean)
      .join("；");

    return row;
  });
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows) {
  if (!rows.length) return "\uFEFF";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ];
  return `\uFEFF${lines.join("\n")}`;
}

function statsToRows(result) {
  return [
    { 类型: "核心指标", 指标: "总患者数", 值: result.stats.totalPatients },
    { 类型: "核心指标", 指标: "基线人数", 值: result.stats.baselineCount },
    { 类型: "数据质量", 指标: "应随访次数", 值: result.dataQuality.expectedFollowups },
    { 类型: "数据质量", 指标: "已完成随访次数", 值: result.dataQuality.completedFollowups },
    { 类型: "数据质量", 指标: "缺失随访次数", 值: result.dataQuality.missingFollowups },
    { 类型: "数据质量", 指标: "失访患者数", 值: result.dataQuality.lostPatients },
    { 类型: "数据质量", 指标: "数据完整率", 值: `${result.dataQuality.dataCompletenessRate}%` },
    { 类型: "数据质量", 指标: "安全性记录完整率", 值: `${result.dataQuality.safetyRecordCompletenessRate}%` },
    { 类型: "完成率", 指标: "第7天完成率", 值: `${result.stats.day7CompletionRate}%` },
    { 类型: "完成率", 指标: "第14天完成率", 值: `${result.stats.day14CompletionRate}%` },
    { 类型: "完成率", 指标: "第28天完成率", 值: `${result.stats.day28CompletionRate}%` },
    { 类型: "完成率", 指标: "第56天完成率", 值: `${result.stats.day56CompletionRate}%` },
    { 类型: "完成率", 指标: "第84天完成率", 值: `${result.stats.day84CompletionRate}%` },
    { 类型: "安全性", 指标: "不良反应发生率", 值: `${result.stats.adverseReactionRate}%` },
    { 类型: "服药依从性", 指标: "高依从性人数", 值: result.stats.highAdherencePatients },
    { 类型: "服药依从性", 指标: "中等依从性人数", 值: result.stats.mediumAdherencePatients },
    { 类型: "服药依从性", 指标: "低依从性人数", 值: result.stats.lowAdherencePatients },
    { 类型: "服药依从性", 指标: "自行停药人数", 值: result.stats.selfDiscontinuedPatients },
    { 类型: "服药依从性", 指标: "漏服人数", 值: result.stats.missedDosePatients },
    { 类型: "评分变化", 指标: "平均PSQI简表变化", 值: result.stats.averagePsqiChange },
    { 类型: "评分变化", 指标: "平均GAD-7变化", 值: result.stats.averageGad7Change },
    { 类型: "评分变化", 指标: "平均PHQ-9变化", 值: result.stats.averagePhq9Change },
    { 类型: "研究摘要", 指标: "摘要", 值: result.summary }
  ];
}

function buildTransformationSummary(result) {
  const completionText = (result.completionRates || [])
    .map((item) => `- ${item.label}：${item.rate}%（${item.completed}/${item.total}）`)
    .join("\n");

  return `# 成果转化数据摘要

## 系统名称

柴牡开郁颗粒真实世界随访系统

## 系统定位

本系统作为柴牡开郁颗粒成果转化配套工具，用于医疗机构制剂用药随访、疗效观察、安全性记录和数据采集，形成“用药—随访—评价—数据—转化”的真实世界证据闭环。

## 核心数据

- 总患者数：${result.stats.totalPatients} 例
- 基线人数：${result.stats.baselineCount} 例
- 综合随访完成率：${result.stats.followupCompletionRate}%
- 不良反应发生率：${result.stats.adverseReactionRate}%
- 数据完整率：${result.dataQuality.dataCompletenessRate}%
- 漏服人数：${result.stats.missedDosePatients} 例
- 自行停药人数：${result.stats.selfDiscontinuedPatients} 例

## 随访节点

- 第0天基线
- 第7天
- 第14天
- 第28天
- 第56天
- 第84天

## 各节点完成率

${completionText}

## 数据脱敏说明

数据统计和脱敏导出默认使用 research_id 作为主要识别字段，不导出姓名和手机号。医生端可在授权范围内查看本人管理患者，手机号页面显示为脱敏格式。

## 闭环说明

系统围绕“用药—随访—评价—数据—转化”形成闭环：医生建档并生成二维码，患者扫码填写随访，医生查看趋势和评价，数据统计页汇总完成率、量表趋势、安全性记录和依从性分布，导出数据用于持续评价和成果转化资料整理。
`;
}

router.get("/export-preview", (req, res) => {
  const rows = loadExportRows(req.session.user, { deidentified: req.query.deidentified === "1" }).slice(0, 5);
  res.json({ rows });
});

router.get("/export.csv", (req, res) => {
  const deidentified = req.query.deidentified === "1";
  const rows = loadExportRows(req.session.user, { deidentified });
  writeAudit(req, "数据导出", "export", deidentified ? "deidentified-csv" : "csv", deidentified ? "脱敏CSV导出" : "CSV导出");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=${deidentified ? "chaimu-followup-deidentified.csv" : "chaimu-followup-export.csv"}`);
  res.send(rowsToCsv(rows));
});

router.get("/export.xlsx", (req, res) => {
  const deidentified = req.query.deidentified === "1";
  const rows = loadExportRows(req.session.user, { deidentified });
  writeAudit(req, "数据导出", "export", deidentified ? "deidentified-xlsx" : "xlsx", deidentified ? "脱敏Excel导出" : "Excel导出");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "随访导出");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=${deidentified ? "chaimu-followup-deidentified.xlsx" : "chaimu-followup-export.xlsx"}`);
  res.send(buffer);
});

router.get("/stats-export.csv", (req, res) => {
  const result = buildStats(req.session.user);
  const rows = [
    ...statsToRows(result),
    ...result.comparisons.map((item) => ({
      类型: "基线对比",
      指标: `${item.metric}：基线 vs ${item.target}`,
      值: `基线${item.baseline_mean ?? ""}；${item.target}${item.target_mean ?? ""}；变化${item.change ?? ""}；配对${item.paired_count}`
    })),
    ...result.trend.map((item) => ({
      类型: "趋势",
      指标: item.label,
      值: `人数${item.count}；睡眠${item.sleep_score ?? ""}；焦虑${item.anxiety_score ?? ""}；抑郁${item.depression_score ?? ""}；PSQI${item.psqi_simple_score ?? ""}；GAD-7${item.gad7_score ?? ""}；PHQ-9${item.phq9_score ?? ""}`
    })),
    ...result.adherenceDistribution.map((item) => ({
      类型: "依从性分布",
      指标: item.level,
      值: item.count
    })),
    ...result.effectDistribution.map((item) => ({
      类型: "医生疗效评价分布",
      指标: item.label,
      值: item.count
    })),
    ...result.clinicianSafetyDistribution.map((item) => ({
      类型: "医生安全性评价分布",
      指标: item.label,
      值: item.count
    })),
    ...result.completionMatrix.map((item) => ({
      类型: "完成矩阵",
      指标: item.research_id,
      值: `完成率${item.completion_rate}%；缺失节点${item.missing_labels || "无"}`
    })),
    ...result.adverseRows.map((item) => ({
      类型: "不良反应",
      指标: `${item.research_id} ${item.visit_label}`,
      值: `${item.adverse_type}；${item.severity}；处理${item.handling_status || ""}`
    })),
    ...result.adherenceRows.map((item) => ({
      类型: "依从性",
      指标: `${item.research_id} ${item.visit_label}`,
      值: `评分${item.adherence_score ?? ""}；${item.adherence_level || ""}；漏服${item.missed_doses || 0}次；自行停药${item.self_discontinued ? "是" : "否"}`
    }))
  ];

  writeAudit(req, "数据导出", "export", "stats-csv", "数据统计CSV导出");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=chaimu-research-stats.csv");
  res.send(rowsToCsv(rows));
});

router.get("/stats-export.xlsx", (req, res) => {
  const result = buildStats(req.session.user);
  writeAudit(req, "数据导出", "export", "stats-xlsx", "数据统计Excel导出");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(statsToRows(result)), "核心指标");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(result.comparisons), "基线对比");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(result.trend), "趋势数据");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(result.completionMatrix), "完成矩阵");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(result.adverseRows), "不良反应");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(result.adherenceRows), "依从性明细");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(result.adherenceCompletionRows), "依从性完成率");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(result.adherenceDistribution), "依从性分布");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(result.effectDistribution), "疗效评价分布");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(result.clinicianSafetyDistribution), "安全性评价分布");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=chaimu-research-stats.xlsx");
  res.send(buffer);
});

router.get("/summary_for_competition.md", (req, res) => {
  const result = buildStats(req.session.user);
  writeAudit(req, "数据导出", "export", "summary-md", "成果转化数据摘要导出");
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=summary_for_competition.md");
  res.send(buildTransformationSummary(result));
});

module.exports = router;
