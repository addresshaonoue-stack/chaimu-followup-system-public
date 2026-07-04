function demoMetric(label, value, suffix = "") {
  return `
    <div class="panel metric premium-stat">
      <span class="label">${App.escape(label)}</span>
      <span class="value">${App.fmt(value)}${suffix}</span>
      <span class="muted">演示数据</span>
    </div>
  `;
}

function lineSvg(labels, values, max, color) {
  const step = values.length > 1 ? 460 / (values.length - 1) : 0;
  const points = values.map((value, index) => `${50 + index * step},${230 - (Number(value || 0) / max) * 180}`).join(" ");
  return `
    <svg viewBox="0 0 560 260" class="mini-line">
      <g stroke="#d8e5ea" stroke-width="1">
        ${[0, 1, 2, 3].map((item) => `<line x1="42" y1="${50 + item * 50}" x2="530" y2="${50 + item * 50}"/>`).join("")}
      </g>
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      ${values.map((value, index) => `<circle cx="${50 + index * step}" cy="${230 - (Number(value || 0) / max) * 180}" r="7" fill="${color}"/><text x="${50 + index * step}" y="248" text-anchor="middle" font-size="16" fill="#617781">${App.escape(labels[index])}</text>`).join("")}
    </svg>
  `;
}

function donutSvg(total, adverse) {
  const safe = Math.max(0, total - adverse);
  const ratio = total ? adverse / total : 0;
  const circumference = 2 * Math.PI * 82;
  return `
    <svg viewBox="0 0 360 260">
      <circle cx="130" cy="130" r="82" fill="none" stroke="#dfeaed" stroke-width="28"/>
      <circle cx="130" cy="130" r="82" fill="none" stroke="#D4AF37" stroke-width="28"
        stroke-dasharray="${circumference * ratio} ${circumference}" transform="rotate(-90 130 130)"/>
      <text x="130" y="124" text-anchor="middle" font-size="34" fill="#0B4F6C" font-weight="900">${adverse}例</text>
      <text x="130" y="154" text-anchor="middle" font-size="16" fill="#617781">已记录不良事件</text>
      <text x="248" y="112" font-size="18" fill="#334155">已记录 ${adverse}</text>
      <text x="248" y="146" font-size="18" fill="#334155">未记录 ${safe}</text>
    </svg>
  `;
}

async function loadDemo() {
  const data = await App.api("/api/demo/overview");
  const metrics = data.metrics;
  document.getElementById("metricGrid").innerHTML = [
    demoMetric("建档患者数", metrics.totalPatients, "例"),
    demoMetric("有效随访记录", metrics.totalFollowups, "条"),
    demoMetric("随访完成率", metrics.followupCompletionRate, "%"),
    demoMetric("数据完整率", metrics.dataCompletenessRate, "%"),
    demoMetric("已记录不良事件", metrics.adverseEventCount, "例"),
    demoMetric("医生已审核记录", metrics.doctorReviewed, "条")
  ].join("");

  const completionLabels = data.completionRates.map((row) => row.label);
  const completionValues = data.completionRates.map((row) => row.rate);
  document.getElementById("demoCompletionChart").innerHTML = lineSvg(completionLabels, completionValues, 100, "#1F7A5C");
  document.getElementById("demoAdverseChart").innerHTML = donutSvg(metrics.totalPatients, metrics.adverseEventCount);

  const labels = data.trend.map((row) => row.label.replace("第0天基线", "基线"));
  document.getElementById("demoScaleChart").innerHTML = `
    <div class="grid">
      <div><div class="muted">睡眠自评</div>${lineSvg(labels, data.trend.map((row) => row.sleep_score), 15, "#D4AF37")}</div>
      <div><div class="muted">GAD-7</div>${lineSvg(labels, data.trend.map((row) => row.gad7_score), 13, "#1F7A5C")}</div>
      <div><div class="muted">PHQ-9</div>${lineSvg(labels, data.trend.map((row) => row.phq9_score), 14, "#0B4F6C")}</div>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  loadDemo().catch((error) => App.toast(error.message));
});
