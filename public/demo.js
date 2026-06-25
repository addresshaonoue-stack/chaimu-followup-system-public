function metric(label, value, icon, suffix = "") {
  return `
    <div class="panel metric">
      <span class="label"><i class="fa ${icon}"></i> ${label}</span>
      <span class="value">${App.fmt(value)}${suffix}</span>
    </div>
  `;
}

function renderMetrics(metrics) {
  document.getElementById("metricGrid").innerHTML = [
    metric("总患者数", metrics.totalPatients, "fa-users", "例"),
    metric("随访完成率", metrics.followupCompletionRate, "fa-line-chart", "%"),
    metric("不良反应发生率", metrics.adverseReactionRate, "fa-shield", "%"),
    metric("数据完整率", metrics.dataCompletenessRate, "fa-database", "%")
  ].join("");
}

function renderCompletionChart(rows) {
  new Chart(document.getElementById("demoCompletionChart"), {
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

function renderAdverseChart(metrics) {
  const adverse = Math.round((metrics.totalPatients || 0) * (metrics.adverseReactionRate || 0) / 100);
  const nonAdverse = Math.max(0, (metrics.totalPatients || 0) - adverse);
  document.getElementById("demoAdverseCenter").textContent = `${App.fmt(metrics.adverseReactionRate)}%`;

  new Chart(document.getElementById("demoAdverseChart"), {
    type: "doughnut",
    data: {
      labels: ["发生", "未发生"],
      datasets: [
        { data: [adverse, nonAdverse], backgroundColor: ["#b91c1c", "#1f7a5c"], borderWidth: 0 }
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

function renderScaleChart(trend) {
  new Chart(document.getElementById("demoScaleChart"), {
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

async function loadDemo() {
  const data = await App.api("/api/demo/overview");
  renderMetrics(data.metrics);
  renderCompletionChart(data.completionRates || []);
  renderAdverseChart(data.metrics);
  renderScaleChart(data.trend || []);
}

document.addEventListener("DOMContentLoaded", () => {
  loadDemo().catch((error) => App.toast(error.message));
});
