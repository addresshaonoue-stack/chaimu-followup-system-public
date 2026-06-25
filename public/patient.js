const token = new URLSearchParams(window.location.search).get("token");
let publicPatient = null;
let schedules = [];

function e(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMissingToken() {
  document.getElementById("patientHeader").innerHTML = `
    <div class="notice danger">
      <i class="fa fa-qrcode"></i>
      <div><strong>请通过医生提供的专属二维码进入</strong><br>患者无需注册，也无需手工输入任何信息；请联系管理医生获取本人专属随访二维码或链接。</div>
    </div>
  `;
  document.getElementById("followupForm").classList.add("hidden");
}

function currentSchedule() {
  return schedules.find((item) => !item.followup_id) || schedules[schedules.length - 1] || null;
}

function renderPatient() {
  const current = currentSchedule();
  const diagnosis = publicPatient.diagnosis || "郁病";
  const syndrome = publicPatient.tcm_syndrome || "痰热内扰";
  document.getElementById("patientHeader").innerHTML = `
    <div class="grid">
      <div class="panel-header">
        <div>
          <h1 class="panel-title">研究编号：${e(publicPatient.research_id || publicPatient.patient_id)}</h1>
          <div class="muted">中医诊断：${e(diagnosis)} · 证型：${e(syndrome)} · 开始用药日期：${e(publicPatient.medication_start_date)} · 管理医生：${e(publicPatient.doctor_name)}</div>
        </div>
        ${publicPatient.consent_signed ? App.pill("已确认知情同意", "ok") : App.pill("知情同意待确认", "warn")}
      </div>
      <div class="grid cols-3">
        <div class="notice ok"><i class="fa fa-id-card-o"></i><div><strong>研究编号</strong><br>${e(publicPatient.research_id || publicPatient.patient_id)}</div></div>
        <div class="notice ok"><i class="fa fa-calendar-check-o"></i><div><strong>当前随访节点</strong><br>${current ? `${e(current.label)} · ${e(current.due_date)}` : "暂无待填写节点"}</div></div>
        <div class="notice ok"><i class="fa fa-shield"></i><div><strong>知情同意确认</strong><br>${publicPatient.consent_signed ? "已确认" : "首次提交前需勾选确认"}</div></div>
      </div>
      <div class="notice">
        <i class="fa fa-info-circle"></i>
        <div>本系统仅用于用药随访和科研数据采集，不提供在线诊疗、不自动诊断、不调整用药。如有明显不适，请及时联系医生或到医疗机构就诊。</div>
      </div>
      <div>
        <button id="startFollowupButton" class="primary" type="button"><i class="fa fa-pencil-square-o"></i> 开始填写</button>
      </div>
    </div>
  `;

  document.getElementById("startFollowupButton")?.addEventListener("click", () => {
    document.getElementById("followupFormPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const consentPanel = document.getElementById("consentPanel");
  const consentCheckbox = document.getElementById("consentConfirmed");
  const needConsent = !publicPatient.consent_signed;
  consentPanel.classList.toggle("hidden", !needConsent);
  consentCheckbox.required = needConsent;
  if (!needConsent) consentCheckbox.checked = false;
}

function renderSchedules() {
  document.getElementById("scheduleList").innerHTML = `
    <table>
      <thead><tr><th>节点</th><th>计划日期</th><th>状态</th></tr></thead>
      <tbody>
        ${schedules.map((item) => `
          <tr>
            <td>${e(item.label)}</td>
            <td>${e(item.due_date)}</td>
            <td>${item.followup_id ? App.pill("已提交", "ok") : App.pill("待填写", "info")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  const select = document.getElementById("scheduleSelect");
  const incomplete = schedules.filter((item) => !item.followup_id);
  select.innerHTML = incomplete.map((item) => `<option value="${item.id}">${e(item.label)} · ${e(item.due_date)}</option>`).join("");
  if (!incomplete.length) {
    select.innerHTML = `<option value="">自定义随访</option>`;
  }
}

async function loadPatient() {
  if (!token) {
    renderMissingToken();
    return;
  }
  const data = await App.api(`/api/followups/patient/${token}`);
  publicPatient = data.patient;
  schedules = data.schedules;
  renderPatient();
  renderSchedules();
}

document.addEventListener("DOMContentLoaded", async () => {
  document.querySelector('[name="visit_date"]').value = new Date().toISOString().slice(0, 10);
  App.bindScoreOutputs();

  document.getElementById("hasAdverse").addEventListener("change", (event) => {
    document.getElementById("adverseFields").classList.toggle("hidden", !event.target.checked);
  });

  try {
    await loadPatient();
  } catch (error) {
    document.getElementById("patientHeader").innerHTML = `
      <div class="notice danger"><i class="fa fa-exclamation-circle"></i><div>${e(error.message)}</div></div>
    `;
    document.getElementById("followupForm").classList.add("hidden");
  }

  document.getElementById("followupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!token) return;
    if (publicPatient && !publicPatient.consent_signed && !document.getElementById("consentConfirmed").checked) {
      App.toast("请先确认知情同意提示");
      return;
    }
    const done = App.setButtonBusy(event.submitter, "提交中");
    try {
      await App.api(`/api/followups/patient/${token}`, {
        method: "POST",
        body: JSON.stringify(App.formJSON(event.currentTarget))
      });
      App.toast("随访已提交");
      event.currentTarget.reset();
      document.querySelector('[name="visit_date"]').value = new Date().toISOString().slice(0, 10);
      document.getElementById("adverseFields").classList.add("hidden");
      App.bindScoreOutputs();
      await loadPatient();
    } catch (error) {
      App.toast(error.message);
    } finally {
      done();
    }
  });
});
