function canDownload() {
  if (!document.getElementById("confirmMask").checked) {
    App.toast("请先确认脱敏和权限要求");
    return false;
  }
  return true;
}

function renderPreview(rows) {
  const head = document.getElementById("previewHead");
  const body = document.getElementById("previewRows");
  if (!rows || !rows.length) {
    head.innerHTML = "";
    body.innerHTML = `<tr><td class="muted">暂无预览数据</td></tr>`;
    return;
  }

  const headers = Object.keys(rows[0]).slice(0, 12);
  head.innerHTML = `<tr>${headers.map((header) => `<th>${App.escape(header)}</th>`).join("")}</tr>`;
  body.innerHTML = rows.map((row) => `
    <tr>${headers.map((header) => `<td>${App.escape(row[header])}</td>`).join("")}</tr>
  `).join("");
}

async function loadPreview() {
  try {
    const deidentified = document.getElementById("deidentifiedExport")?.checked ? "?deidentified=1" : "";
    const data = await App.api(`/api/research/export-preview${deidentified}`);
    renderPreview(data.rows || []);
  } catch (error) {
    renderPreview([{ 状态: "新版导出预览接口将在服务重启后加载", 说明: "当前下载按钮仍可使用" }]);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = await App.requireAuth(["doctor", "admin"]);
  if (!user) return;
  App.bindLogout();
  await loadPreview();

  document.getElementById("deidentifiedExport").addEventListener("change", () => {
    loadPreview().catch((error) => App.toast(error.message));
  });

  document.getElementById("csvBtn").addEventListener("click", () => {
    if (canDownload()) {
      const deidentified = document.getElementById("deidentifiedExport").checked ? "?deidentified=1" : "";
      window.location.href = `/api/research/export.csv${deidentified}`;
    }
  });

  document.getElementById("xlsxBtn").addEventListener("click", () => {
    if (canDownload()) {
      const deidentified = document.getElementById("deidentifiedExport").checked ? "?deidentified=1" : "";
      window.location.href = `/api/research/export.xlsx${deidentified}`;
    }
  });

  document.getElementById("statsCsvBtn").addEventListener("click", () => {
    if (canDownload()) window.location.href = "/api/research/stats-export.csv";
  });

  document.getElementById("statsXlsxBtn").addEventListener("click", () => {
    if (canDownload()) window.location.href = "/api/research/stats-export.xlsx";
  });

  document.getElementById("summaryMdBtn").addEventListener("click", () => {
    if (canDownload()) window.location.href = "/api/research/summary_for_competition.md";
  });
});
