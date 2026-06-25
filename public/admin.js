let adminUser = null;

function metric(label, value, icon) {
  return `
    <div class="panel metric">
      <span class="label"><i class="fa ${icon}"></i> ${label}</span>
      <span class="value">${App.fmt(value)}</span>
    </div>
  `;
}

async function loadSummary() {
  const { summary } = await App.api("/api/admin/summary");
  document.getElementById("summary").innerHTML = [
    metric("医生账号", summary.doctors, "fa-user-md"),
    metric("患者总数", summary.patients, "fa-address-book"),
    metric("随访记录", summary.followups, "fa-calendar-check-o"),
    metric("不良反应", summary.adverseReactions, "fa-exclamation-circle")
  ].join("");
}

async function loadDoctors() {
  const { doctors } = await App.api("/api/admin/doctors");
  document.getElementById("doctorRows").innerHTML = doctors.map((doctor) => `
    <tr>
      <td>${doctor.username}</td>
      <td>${doctor.display_name}</td>
      <td>${App.fmt(doctor.department)}</td>
      <td>${doctor.is_active ? App.pill("启用", "ok") : App.pill("停用", "warn")}</td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="muted">暂无医生账号</td></tr>`;
}

async function loadPatients() {
  const { patients } = await App.api("/api/admin/patients");
  document.getElementById("patientRows").innerHTML = patients.map((patient) => `
    <tr>
      <td>${patient.research_id}</td>
      <td>${patient.patient_id}</td>
      <td>${patient.name}</td>
      <td>${App.fmt(patient.phone_masked)}</td>
      <td>${patient.sex} / ${patient.age}</td>
      <td>${patient.diagnosis}</td>
      <td>${patient.tcm_syndrome}</td>
      <td>${patient.doctor_name}</td>
      <td>${patient.followup_count}</td>
      <td>${patient.consent_signed ? App.pill("已签署", "ok") : App.pill("待补", "warn")}</td>
      <td>${patient.token_disabled ? App.pill("已禁用", "danger") : App.pill("有效", "ok")}</td>
    </tr>
  `).join("") || `<tr><td colspan="11" class="muted">暂无患者</td></tr>`;
}

async function loadAuditLogs() {
  const { logs } = await App.api("/api/admin/audit-logs");
  document.getElementById("auditRows").innerHTML = logs.map((log) => `
    <tr>
      <td>${App.escape(log.created_at)}</td>
      <td>${App.escape(log.actor_name || "")}</td>
      <td>${App.escape(log.actor_role || "")}</td>
      <td>${App.escape(log.action_type)}</td>
      <td>${App.escape(log.object_type)} ${App.escape(log.object_id || "")}</td>
      <td>${App.escape(log.summary || "")}</td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="muted">暂无审计日志</td></tr>`;
}

async function refreshAll() {
  await Promise.all([loadSummary(), loadDoctors(), loadPatients(), loadAuditLogs()]);
}

document.addEventListener("DOMContentLoaded", async () => {
  adminUser = await App.requireAuth(["admin"]);
  if (!adminUser) return;
  App.bindLogout();
  await refreshAll();

  document.getElementById("refreshDoctors").addEventListener("click", () => {
    loadDoctors().catch((error) => App.toast(error.message));
  });
  document.getElementById("refreshPatients").addEventListener("click", () => {
    loadPatients().catch((error) => App.toast(error.message));
  });
  document.getElementById("refreshAuditLogs").addEventListener("click", () => {
    loadAuditLogs().catch((error) => App.toast(error.message));
  });

  document.getElementById("doctorForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const done = App.setButtonBusy(event.submitter, "创建中");
    try {
      await App.api("/api/admin/doctors", {
        method: "POST",
        body: JSON.stringify(App.formJSON(event.currentTarget))
      });
      event.currentTarget.reset();
      App.toast("医生账号已创建");
      await loadDoctors();
      await loadSummary();
    } catch (error) {
      App.toast(error.message);
    } finally {
      done();
    }
  });
});
