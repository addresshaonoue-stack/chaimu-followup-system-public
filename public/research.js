let completionLineChart = null;
let adverseDonutChart = null;
let scaleTrendChart = null;
let symptomChangeChart = null;
let adherenceDistributionChart = null;
let effectDistributionChart = null;
let safetyDistributionChart = null;
let followupRecordChart = null;
let personalChart = null;
let patientCache = [];
let selectedPatientId = null;

function e(value) {
  return App.escape(value);
}

function metric(label, value, icon, suffix = "") {
  return `
    <div class="panel metric">
      <span class="label"><i class="fa ${icon}"></i> ${label}</span>
      <span class="value">${App.fmt(value)}${suffix}</span>
    </div>
  `;
}

function chartColors(count = 6) {
  const colors = ["#1f7a5c", "#2563eb", "#b45309", "#64748b", "#0f766e", "#7c3aed"];
  return Array.from({ length: count }, (_, index) => colors[index % colors.length]);
}

function renderStats(stats, dataQuality) {
  document.getElementById("statsGrid").innerHTML = [
    metric("总患者数", stats.totalPatients, "fa-users", "例"),
    metric("综合随访完成率", stats.followupCompletionRate, "fa-line-chart", "%"),
    metric("不良反应发生率", stats.adverseReactionRate, "fa-shield", "%"),
    metric("数据完整率", dataQuality.dataCompletenessRate, "fa-database", "%")
  ].join("");
}

function renderCompletionLine(rows = []) {
  if (completionLineChart) completionLineChart.destroy();
  completionLineChart = new Chart(document.getElementById("completionLineChart"), {
    type: "line",
    data: {
      labels: rows.map((row) => row.label),
      datasets: [
        {
          label: "完成率%",
          data: rows.map((row) => row.rate),
          borderColor: "#1f7a5c",
          backgroundColor: "rgba(31, 122, 92, 0.16)",
          fill: true,
          tension: 0.25,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { min: 0, max: 100, ticks: { stepSize: 10 } } },
      plugins: { legend: { position: "bottom" } }
    }
  });
}

function renderAdverseDonut(stats) {
  if (adverseDonutChart) adverseDonutChart.destroy();
  const adverse = Math.round((stats.totalPatients || 0) * (stats.adverseReactionRate || 0) / 100);
  const nonAdverse = Math.max(0, (stats.totalPatients || 0) - adverse);
  document.getElementById("adverseCenter").textContent = `${App.fmt(stats.adverseReactionRate)}%`;
  const status = document.getElementById("adverseStatus");
  if (status) {
    status.textContent = adverse === 0 ? "当前模拟随访数据未记录不良反应事件，正式应用中将持续开展安全性监测。" : `已记录不良反应患者 ${adverse} 例`;
  }

  adverseDonutChart = new Chart(document.getElementById("adverseDonutChart"), {
    type: "doughnut",
    data: {
      labels: ["发生", "未发生"],
      datasets: [
        {
          data: [adverse, nonAdverse],
          backgroundColor: ["#b91c1c", "#1f7a5c"],
          borderWidth: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: { legend: { position: "bottom" } }
    }
  });
}

function renderScaleTrend(trend = []) {
  if (scaleTrendChart) scaleTrendChart.destroy();
  scaleTrendChart = new Chart(document.getElementById("scaleTrendChart"), {
    type: "line",
    data: {
      labels: trend.map((row) => row.label.replace("第0天基线", "基线")),
      datasets: [
        { label: "PSQI简表", data: trend.map((row) => row.psqi_simple_score), borderColor: "#1f7a5c", backgroundColor: "#1f7a5c", tension: 0.25 },
        { label: "GAD-7", data: trend.map((row) => row.gad7_score), borderColor: "#2563eb", backgroundColor: "#2563eb", tension: 0.25 },
        { label: "PHQ-9", data: trend.map((row) => row.phq9_score), borderColor: "#b45309", backgroundColor: "#b45309", tension: 0.25 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { position: "bottom" } }
    }
  });
}

function renderSymptomChange(trend = []) {
  if (symptomChangeChart) symptomChangeChart.destroy();
  const baseline = trend.find((row) => row.label === "第0天基线") || trend[0] || {};
  const day84 = trend.find((row) => row.label === "第84天") || trend[trend.length - 1] || {};
  const metrics = [
    ["睡眠", "sleep_score"],
    ["焦虑", "anxiety_score"],
    ["抑郁", "depression_score"],
    ["心烦", "irritability_score"]
  ];

  symptomChangeChart = new Chart(document.getElementById("symptomChangeChart"), {
    type: "bar",
    data: {
      labels: metrics.map(([label]) => label),
      datasets: [
        { label: "基线均值", data: metrics.map(([, key]) => baseline[key]), backgroundColor: "#94a3b8" },
        { label: "第84天均值", data: metrics.map(([, key]) => day84[key]), backgroundColor: "#1f7a5c" }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { min: 0, max: 10, ticks: { stepSize: 1 } } },
      plugins: { legend: { position: "bottom" } }
    }
  });
}

function renderAdherenceDistribution(rows = []) {
  if (adherenceDistributionChart) adherenceDistributionChart.destroy();
  const dataRows = rows.filter((row) => row.level !== "未记录" && Number(row.count) > 0);
  adherenceDistributionChart = new Chart(document.getElementById("adherenceDistributionChart"), {
    type: "doughnut",
    data: {
      labels: dataRows.map((row) => row.level),
      datasets: [
        {
          label: "人数",
          data: dataRows.map((row) => row.count),
          backgroundColor: chartColors(dataRows.length),
          borderWidth: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: { legend: { position: "bottom" } }
    }
  });
}

function renderEffectDistribution(rows = []) {
  if (effectDistributionChart) effectDistributionChart.destroy();
  const dataRows = rows.filter((row) => Number(row.count) > 0);
  effectDistributionChart = new Chart(document.getElementById("effectDistributionChart"), {
    type: "bar",
    data: {
      labels: dataRows.map((row) => row.label),
      datasets: [
        {
          label: "例数",
          data: dataRows.map((row) => row.count),
          backgroundColor: chartColors(dataRows.length)
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { display: false } }
    }
  });
}

function renderSafetyDistribution(rows = []) {
  if (safetyDistributionChart) safetyDistributionChart.destroy();
  const dataRows = rows.filter((row) => Number(row.count) > 0);
  safetyDistributionChart = new Chart(document.getElementById("safetyDistributionChart"), {
    type: "doughnut",
    data: {
      labels: dataRows.map((row) => row.label),
      datasets: [
        {
          label: "例数",
          data: dataRows.map((row) => row.count),
          backgroundColor: chartColors(dataRows.length),
          borderWidth: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: { legend: { position: "bottom" } }
    }
  });
}

function renderFollowupRecordChart(rows = []) {
  if (followupRecordChart) followupRecordChart.destroy();
  followupRecordChart = new Chart(document.getElementById("followupRecordChart"), {
    type: "bar",
    data: {
      labels: rows.map((row) => row.label),
      datasets: [
        {
          label: "次数",
          data: rows.map((row) => row.value),
          backgroundColor: ["#64748b", "#1f7a5c", "#b45309", "#2563eb"]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { display: false } }
    }
  });
}

function renderTrendTable(trend = []) {
  document.getElementById("trendRows").innerHTML = trend.map((row) => `
    <tr>
      <td>${e(row.label)}</td>
      <td>${row.count}</td>
      <td>${App.fmt(row.sleep_score)}</td>
      <td>${App.fmt(row.anxiety_score)}</td>
      <td>${App.fmt(row.depression_score)}</td>
      <td>${App.fmt(row.irritability_score)}</td>
      <td>${App.fmt(row.psqi_simple_score)}</td>
      <td>${App.fmt(row.gad7_score)}</td>
      <td>${App.fmt(row.phq9_score)}</td>
    </tr>
  `).join("");
}

function renderCompletionMatrix(rows = []) {
  const labels = ["第0天基线", "第7天", "第14天", "第28天", "第56天", "第84天"];
  document.getElementById("completionMatrixRows").innerHTML = rows.map((row) => `
    <tr>
      <td>${e(row.research_id)}</td>
      <td>${App.fmt(row.completion_rate)}%</td>
      ${labels.map((label) => `<td>${row[label] === "完成" ? App.pill("完成", "ok") : App.pill("缺失", "warn")}</td>`).join("")}
      <td>${e(row.missing_labels || "无")}</td>
    </tr>
  `).join("") || `<tr><td colspan="9" class="muted">暂无完成矩阵数据</td></tr>`;
}

function renderAdherenceRows(rows = []) {
  document.getElementById("adherenceRows").innerHTML = rows.map((row) => `
    <tr>
      <td>${e(row.research_id)}</td>
      <td>${e(row.visit_label)}</td>
      <td>${e(row.visit_date)}</td>
      <td>${App.fmt(row.adherence_score)}</td>
      <td>${e(row.adherence_level || "未记录")}</td>
      <td>${App.boolText(row.adherence_forget)}</td>
      <td>${App.boolText(row.adherence_regular)}</td>
    </tr>
  `).join("") || `<tr><td colspan="7" class="muted">暂无依从性记录</td></tr>`;
}

function renderAdverseRows(rows = []) {
  document.getElementById("adverseRows").innerHTML = rows.length
    ? rows.map((row) => `
      <tr>
        <td>${e(row.research_id)}</td>
        <td>${e(row.visit_label)}</td>
        <td>${e(row.adverse_type)}</td>
        <td>${e(row.severity)}</td>
        <td>${e(row.handling_status || "未处理")}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="5" class="muted">当前模拟随访数据未记录不良反应事件，正式应用中将持续开展安全性监测。</td></tr>`;
}

function renderPatientRows(filter = "") {
  const keyword = filter.trim().toLowerCase();
  const rows = patientCache.filter((patient) => {
    const haystack = [
      patient.research_id,
      patient.sex,
      patient.age,
      patient.diagnosis,
      patient.tcm_syndrome
    ].join(" ").toLowerCase();
    return !keyword || haystack.includes(keyword);
  });

  document.getElementById("patientTableCount").textContent = String(rows.length);
  document.getElementById("patientRows").innerHTML = rows.map((patient) => `
    <tr class="${selectedPatientId === patient.id ? "bg-green-50" : ""}">
      <td><button class="btn ghost" data-patient-id="${patient.id}">${e(patient.research_id)}</button></td>
      <td>${e(patient.sex)}</td>
      <td>${e(patient.age)}</td>
      <td>${e(patient.diagnosis)}</td>
      <td>${e(patient.tcm_syndrome)}</td>
      <td>${patient.followup_count || 0}</td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="muted">暂无数据</td></tr>`;
}

function renderPersonalChart(followups = []) {
  if (personalChart) personalChart.destroy();
  const canvas = document.getElementById("personalChart");
  if (!canvas || !followups.length) return;

  personalChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: followups.map((item) => item.visit_label.replace("第0天基线", "基线")),
      datasets: [
        { label: "睡眠", data: followups.map((item) => item.sleep_score), borderColor: "#1f7a5c", backgroundColor: "#1f7a5c", tension: 0.25 },
        { label: "焦虑", data: followups.map((item) => item.anxiety_score), borderColor: "#2563eb", backgroundColor: "#2563eb", tension: 0.25 },
        { label: "抑郁", data: followups.map((item) => item.depression_score), borderColor: "#b45309", backgroundColor: "#b45309", tension: 0.25 },
        { label: "心烦", data: followups.map((item) => item.irritability_score), borderColor: "#64748b", backgroundColor: "#64748b", tension: 0.25 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { min: 0, max: 10, ticks: { stepSize: 1 } } },
      plugins: { legend: { position: "bottom" } }
    }
  });
}

function renderPersonalPanel(data) {
  const { patient, followups } = data;
  document.getElementById("personalPanel").innerHTML = `
    <div class="panel-header">
      <div>
        <h2 class="panel-title">${e(patient.research_id || patient.patient_id)}</h2>
        <div class="muted">${e(patient.sex)} / ${e(patient.age)}岁 · ${e(patient.diagnosis)} · ${e(patient.tcm_syndrome)}</div>
      </div>
      <span class="pill info">${followups.length} 条记录</span>
    </div>
    <div style="height:260px">
      ${followups.length ? `<canvas id="personalChart"></canvas>` : `<div class="empty">暂无个人趋势数据</div>`}
    </div>
    <div class="section table-wrap">
      <table>
        <thead>
          <tr>
            <th>节点</th>
            <th>日期</th>
            <th>睡眠</th>
            <th>焦虑</th>
            <th>抑郁</th>
            <th>心烦</th>
            <th>PSQI</th>
            <th>GAD-7</th>
            <th>PHQ-9</th>
            <th>依从性</th>
          </tr>
        </thead>
        <tbody>
          ${followups.map((item) => `
            <tr>
              <td>${e(item.visit_label)}</td>
              <td>${e(item.visit_date)}</td>
              <td>${App.fmt(item.sleep_score)}</td>
              <td>${App.fmt(item.anxiety_score)}</td>
              <td>${App.fmt(item.depression_score)}</td>
              <td>${App.fmt(item.irritability_score)}</td>
              <td>${App.fmt(item.psqi_simple_score)}</td>
              <td>${App.fmt(item.gad7_score)}</td>
              <td>${App.fmt(item.phq9_score)}</td>
              <td>${e(item.adherence_level || "未记录")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  renderPersonalChart(followups);
}

async function selectPatient(id) {
  selectedPatientId = Number(id);
  renderPatientRows(document.getElementById("patientSearch").value);
  const data = await App.api(`/api/patients/${id}`);
  renderPersonalPanel(data);
}

async function loadPatients() {
  const data = await App.api("/api/patients");
  patientCache = data.patients || [];
  renderPatientRows();
  if (patientCache.length && !selectedPatientId) {
    await selectPatient(patientCache[0].id);
  }
}

async function loadStats() {
  const data = await App.api("/api/research/stats");
  renderStats(data.stats, data.dataQuality);
  renderCompletionLine(data.completionRates || []);
  renderAdverseDonut(data.stats);
  renderScaleTrend(data.trend || []);
  renderSymptomChange(data.trend || []);
  renderAdherenceDistribution(data.adherenceDistribution || []);
  renderEffectDistribution(data.effectDistribution || []);
  renderSafetyDistribution(data.clinicianSafetyDistribution || []);
  renderFollowupRecordChart(data.recordSummary || []);
  renderTrendTable(data.trend || []);
  renderCompletionMatrix(data.completionMatrix || []);
  renderAdherenceRows(data.adherenceRows || []);
  renderAdverseRows(data.adverseRows || []);
  await loadPatients();
}

function confirmDeidentifiedExport() {
  return window.confirm("将导出脱敏数据，仅保留研究编号，不导出姓名和手机号。");
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = await App.requireAuth(["doctor", "admin"]);
  if (!user) return;
  App.bindLogout();
  await loadStats();

  document.getElementById("refreshStats").addEventListener("click", () => {
    loadStats().catch((error) => App.toast(error.message));
  });

  document.getElementById("exportDeidentifiedCsv").addEventListener("click", () => {
    if (confirmDeidentifiedExport()) window.location.href = "/api/research/export.csv?deidentified=1";
  });

  document.getElementById("exportDeidentifiedXlsx").addEventListener("click", () => {
    if (confirmDeidentifiedExport()) window.location.href = "/api/research/export.xlsx?deidentified=1";
  });

  document.getElementById("patientSearch").addEventListener("input", (event) => {
    renderPatientRows(event.target.value);
  });

  document.getElementById("patientRows").addEventListener("click", (event) => {
    const button = event.target.closest("[data-patient-id]");
    if (!button) return;
    selectPatient(button.datasetPatientId || button.dataset.patientId).catch((error) => App.toast(error.message));
  });
});
