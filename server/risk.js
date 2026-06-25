const dayjs = require("dayjs");

const TREND_METRICS = [
  { key: "sleep_score", label: "睡眠评分" },
  { key: "anxiety_score", label: "焦虑评分" },
  { key: "depression_score", label: "抑郁评分" },
  { key: "irritability_score", label: "心烦评分" }
];

function sortFollowups(followups) {
  return [...followups].sort((a, b) => {
    const dateCompare = String(a.visit_date).localeCompare(String(b.visit_date));
    if (dateCompare !== 0) return dateCompare;
    return a.id - b.id;
  });
}

function findTwoStepIncrease(followups) {
  const ordered = sortFollowups(followups);
  const alerts = [];

  for (const metric of TREND_METRICS) {
    for (let i = 2; i < ordered.length; i += 1) {
      const a = Number(ordered[i - 2][metric.key]);
      const b = Number(ordered[i - 1][metric.key]);
      const c = Number(ordered[i][metric.key]);
      if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && a < b && b < c) {
        alerts.push({
          type: "score_increase",
          level: "warning",
          title: "连续2次评分升高",
          message: `${metric.label}在最近连续两次随访中升高：${a} -> ${b} -> ${c}`
        });
        break;
      }
    }
  }

  return alerts;
}

function computePatientRisks(patient, followups, now = dayjs()) {
  const ordered = sortFollowups(followups);
  const alerts = [];

  alerts.push(...findTwoStepIncrease(ordered));

  const missedCount = ordered.filter((item) => Number(item.missed_doses) > 0 || !item.on_time_medication).length;
  if (missedCount >= 2) {
    alerts.push({
      type: "multiple_missed_doses",
      level: "warning",
      title: "多次漏服",
      message: `已有 ${missedCount} 次随访记录提示漏服或未按时服药`
    });
  }

  const lastFollowup = ordered[ordered.length - 1];
  const anchorDate = lastFollowup ? lastFollowup.visit_date : patient.medication_start_date;
  if (anchorDate && now.diff(dayjs(anchorDate), "day") >= 7) {
    alerts.push({
      type: "missed_followup",
      level: "warning",
      title: "连续7天未随访",
      message: `最近一次随访日期为 ${anchorDate}`
    });
  }

  for (const item of ordered) {
    if (item.has_adverse_reaction && ["中", "重"].includes(item.severity)) {
      alerts.push({
        type: "adverse_reaction",
        level: item.severity === "重" ? "danger" : "warning",
        title: "中重度不良反应",
        message: `${item.visit_label} 出现${item.severity}度不良反应：${item.adverse_type || "未填写类型"}`
      });
    }

    if (item.self_discontinued) {
      alerts.push({
        type: "self_discontinued",
        level: "danger",
        title: "自行停药",
        message: `${item.visit_label} 记录患者自行停药`
      });
    }
  }

  return alerts;
}

module.exports = {
  TREND_METRICS,
  computePatientRisks,
  sortFollowups
};
