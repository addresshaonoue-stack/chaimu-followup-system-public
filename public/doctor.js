let doctorUser = null;
let patients = [];
let selectedPatientId = null;
let scoreChart = null;
let scaleChart = null;
let patientFilter = "all";

function e(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function patientButton(patient) {
  const active = selectedPatientId === patient.id ? "active" : "";
  const completionRate = patient.completion_rate ?? 0;
  const riskType = patient.risk_level === "高" ? "danger" : patient.risk_level === "中" ? "warn" : "ok";
  const overduePill = patient.is_overdue ? App.pill("逾期", "warn") : App.pill("未逾期", "ok");
  return `
    <button class="patient-row ${active}" data-patient-id="${patient.id}">
      <div class="patient-main">
        <strong>${e(patient.name)}</strong>
        ${App.pill(`风险${e(patient.risk_level || "低")}`, riskType)}
      </div>
      <div class="muted">${e(patient.sex)} / ${e(patient.age)}岁 · ${e(patient.tcm_syndrome)}</div>
      <div class="muted mt-1">${e(patient.research_id || patient.patient_id)} · ${e(patient.patient_id)}</div>
      <div class="mt-2">
        <span class="pill info">完成率 ${App.fmt(completionRate)}%</span>
        ${overduePill}
      </div>
      <div class="muted mt-1">最近：${e(patient.last_followup_date || "暂无")} · 下次：${e(patient.next_due_label || "无")} ${e(patient.next_due_date || "")}</div>
      <div class="mt-2">${App.riskPills(patient.risks)}</div>
    </button>
  `;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function isDuePatient(patient) {
  return Boolean(patient.next_due_date && patient.next_due_date <= todayString());
}

function isOverduePatient(patient) {
  return Boolean(patient.is_overdue);
}

function isAttentionPatient(patient) {
  const risks = patient.risks || [];
  const notes = String(patient.notes || "");
  return risks.length > 0
    || Number(patient.completion_rate || 0) < 100
    || patient.is_overdue
    || Number(patient.adverse_count || 0) > 0
    || notes.includes("关注");
}

function quickFilterCard(key, label, value, icon, hint) {
  const active = patientFilter === key ? "active" : "";
  return `
    <button class="panel metric quick-filter ${active}" type="button" data-filter="${key}">
      <span class="label"><i class="fa ${icon}"></i> ${label}</span>
      <span class="value">${value}</span>
      <span class="muted">${hint}</span>
    </button>
  `;
}

function renderQuickFilters() {
  const dueCount = patients.filter(isDuePatient).length;
  const overdueCount = patients.filter(isOverduePatient).length;
  const attentionCount = patients.filter(isAttentionPatient).length;
  const grid = document.getElementById("quickFilterGrid");
  if (!grid) return;
  grid.innerHTML = [
    quickFilterCard("due", "本次应随访患者", dueCount, "fa-calendar-check-o", "到期或待处理节点"),
    quickFilterCard("overdue", "逾期随访患者", overdueCount, "fa-clock-o", "计划日期已过"),
    quickFilterCard("attention", "需关注患者", attentionCount, "fa-exclamation-triangle", "风险、漏服、缺失或医生标记")
  ].join("");
}

function visiblePatients() {
  if (patientFilter === "due") return patients.filter(isDuePatient);
  if (patientFilter === "overdue") return patients.filter(isOverduePatient);
  if (patientFilter === "attention") return patients.filter(isAttentionPatient);
  return patients;
}

function renderPatientList() {
  const rows = visiblePatients();
  document.getElementById("patientCount").textContent = String(rows.length);
  document.getElementById("patientList").innerHTML = rows.map(patientButton).join("") || `<div class="empty">暂无匹配患者</div>`;
}

async function loadPatients() {
  const data = await App.api("/api/patients");
  patients = data.patients;
  renderQuickFilters();
  renderPatientList();
}

function statusPill(schedule) {
  if (schedule.followup_id) return App.pill("已完成", "ok");
  const today = new Date().toISOString().slice(0, 10);
  if (schedule.due_date < today) return App.pill("待补", "warn");
  return App.pill("待随访", "info");
}

function renderRisks(risks) {
  if (!risks.length) {
    return `<div class="notice ok"><i class="fa fa-check-circle"></i><div>当前无风险预警</div></div>`;
  }
  return risks.map((risk) => `
    <div class="notice ${risk.level === "danger" ? "danger" : ""}">
      <i class="fa ${risk.level === "danger" ? "fa-exclamation-circle" : "fa-exclamation-triangle"}"></i>
      <div><strong>${e(risk.title)}</strong><br><span>${e(risk.message)}</span><br><span class="muted">预警原因：${e(risk.type)}</span></div>
    </div>
  `).join("");
}

function renderSchedules(schedules) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>节点</th><th>计划日期</th><th>类型</th><th>状态</th></tr></thead>
        <tbody>
          ${schedules.map((schedule) => `
            <tr>
              <td>${e(schedule.label)}</td>
              <td>${e(schedule.due_date)}</td>
              <td>${schedule.is_custom ? "自定义" : "固定"}</td>
              <td>${statusPill(schedule)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderProgress(schedules) {
  const total = schedules.length;
  const completed = schedules.filter((schedule) => schedule.followup_id).length;
  const rate = total ? Math.round((completed / total) * 1000) / 10 : 0;
  const today = new Date().toISOString().slice(0, 10);
  return `
    <div class="panel">
      <div class="panel-header">
        <h3 class="panel-title">84天随访进度</h3>
        <span class="pill info">${completed}/${total} · ${rate}%</span>
      </div>
      <div style="height:12px;background:#eef4ef;border-radius:999px;overflow:hidden">
        <div style="width:${rate}%;height:12px;background:#1f7a5c"></div>
      </div>
      <div class="grid cols-3 mt-4">
        ${schedules.map((schedule) => {
          const done = Boolean(schedule.followup_id);
          const overdue = !done && schedule.due_date < today;
          return `
            <div class="notice ${done ? "ok" : overdue ? "" : "ok"}">
              <i class="fa ${done ? "fa-check-circle" : "fa-clock-o"}"></i>
              <div><strong>${e(schedule.label)}</strong><br>${e(schedule.due_date)} · ${done ? "已完成" : overdue ? "待补" : "待随访"}</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderFollowups(followups) {
  if (!followups.length) return `<div class="empty">暂无随访记录</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>节点</th>
            <th>日期</th>
            <th>睡眠</th>
            <th>焦虑</th>
            <th>抑郁</th>
            <th>心烦</th>
            <th>服药</th>
            <th>不良反应</th>
          </tr>
        </thead>
        <tbody>
          ${followups.map((item) => `
            <tr>
              <td>${e(item.visit_label)}</td>
              <td>${e(item.visit_date)}</td>
              <td>${item.sleep_score}</td>
              <td>${item.anxiety_score}</td>
              <td>${item.depression_score}</td>
              <td>${item.irritability_score}</td>
              <td>${item.on_time_medication ? "按时" : "未按时"}；漏服${item.missed_doses}次${item.self_discontinued ? "；自行停药" : ""}</td>
              <td>${item.has_adverse_reaction ? App.pill(`${e(item.severity || "未分级")}：${e(item.adverse_type || "未填")}`, item.severity === "重" ? "danger" : "warn") : App.pill("未记录", "ok")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdverse(followups) {
  const adverse = followups.filter((item) => item.has_adverse_reaction || item.self_discontinued);
  if (!adverse.length) return `<div class="empty">当前模拟随访数据未记录不良反应事件，正式应用中将持续开展安全性监测。</div>`;

  return adverse.map((item) => `
    <form class="panel adverse-form" data-followup-id="${item.id}">
      <div class="panel-header">
        <h3 class="panel-title">${e(item.visit_label)} · ${e(item.visit_date)}</h3>
        ${item.has_adverse_reaction ? App.pill(`${e(item.severity || "未分级")}不良反应`, item.severity === "重" ? "danger" : "warn") : App.pill("自行停药", "danger")}
      </div>
      <div class="grid cols-2">
        <div>
          <div><strong>类型：</strong>${e(item.adverse_type || "未填写")}</div>
          <div><strong>描述：</strong>${e(item.adverse_description || "无")}</div>
          <div><strong>停药：</strong>${App.boolText(item.stopped_due_adverse || item.self_discontinued)}</div>
          <div><strong>就医：</strong>${App.boolText(item.sought_medical_help)}</div>
        </div>
        <div class="grid">
          <div class="field">
            <label>处理状态</label>
            <select name="doctor_handling_status">
              ${["未处理", "处理中", "已处理", "无需处理"].map((status) => `<option ${status === item.doctor_handling_status ? "selected" : ""}>${status}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>医生备注</label>
            <textarea name="doctor_note">${e(item.doctor_note || "")}</textarea>
          </div>
          <div class="field">
            <label>处理记录</label>
            <textarea name="doctor_handling_note">${e(item.doctor_handling_note || "")}</textarea>
          </div>
          <button class="primary" type="submit"><i class="fa fa-save"></i> 保存处理</button>
        </div>
      </div>
    </form>
  `).join("");
}

function renderNotes(notes) {
  if (!notes.length) return `<div class="empty">暂无医生备注</div>`;
  return notes.map((note) => `
    <div class="notice ok">
      <i class="fa fa-pencil"></i>
      <div><strong>${e(note.doctor_name)}</strong> <span class="muted">${e(note.created_at)}</span><br>${e(note.note)}</div>
    </div>
  `).join("");
}

function renderHandlingTimeline(followups, notes) {
  const events = [
    ...followups
      .filter((item) => item.has_adverse_reaction || item.self_discontinued || item.doctor_handling_note)
      .map((item) => ({
        time: item.handled_at || item.submitted_at || item.visit_date,
        title: `${item.visit_label} 处理记录`,
        text: item.doctor_handling_note || item.doctor_note || item.adverse_description || "已记录随访风险"
      })),
    ...notes.map((note) => ({
      time: note.created_at,
      title: `${note.doctor_name} 备注`,
      text: note.note
    }))
  ].sort((a, b) => String(b.time).localeCompare(String(a.time)));

  if (!events.length) return `<div class="empty">暂无处理时间线</div>`;
  return events.map((event) => `
    <div class="notice ok">
      <i class="fa fa-history"></i>
      <div><strong>${e(event.title)}</strong> <span class="muted">${e(event.time || "")}</span><br>${e(event.text)}</div>
    </div>
  `).join("");
}

function renderTrend(followups) {
  if (scoreChart) scoreChart.destroy();
  const canvas = document.getElementById("scoreChart");
  if (!canvas || !followups.length) return;

  scoreChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: followups.map((item) => item.visit_label),
      datasets: [
        { label: "睡眠", data: followups.map((item) => item.sleep_score), borderColor: "#1f7a5c", backgroundColor: "#1f7a5c", tension: 0.25 },
        { label: "焦虑", data: followups.map((item) => item.anxiety_score), borderColor: "#2563eb", backgroundColor: "#2563eb", tension: 0.25 },
        { label: "抑郁", data: followups.map((item) => item.depression_score), borderColor: "#b45309", backgroundColor: "#b45309", tension: 0.25 },
        { label: "心烦", data: followups.map((item) => item.irritability_score), borderColor: "#b91c1c", backgroundColor: "#b91c1c", tension: 0.25 }
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

function renderScaleTrend(followups) {
  if (scaleChart) scaleChart.destroy();
  const canvas = document.getElementById("scaleChart");
  if (!canvas || !followups.length) return;

  scaleChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: followups.map((item) => item.visit_label),
      datasets: [
        { label: "PSQI简表", data: followups.map((item) => item.psqi_simple_score), borderColor: "#1f7a5c", backgroundColor: "#1f7a5c", tension: 0.25 },
        { label: "GAD-7", data: followups.map((item) => item.gad7_score), borderColor: "#2563eb", backgroundColor: "#2563eb", tension: 0.25 },
        { label: "PHQ-9", data: followups.map((item) => item.phq9_score), borderColor: "#b45309", backgroundColor: "#b45309", tension: 0.25 },
        { label: "依从性", data: followups.map((item) => item.adherence_score), borderColor: "#b91c1c", backgroundColor: "#b91c1c", tension: 0.25 }
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

function renderEvaluationForm(patientId) {
  return `
    <form id="evaluationForm" class="form-grid">
      <div class="field"><label>评价日期</label><input name="evaluation_date" type="date" required value="${new Date().toISOString().slice(0, 10)}"></div>
      <div class="field"><label>疗效评价</label><select name="clinician_effect"><option>暂未评价</option><option>显效</option><option>有效</option><option>无效</option><option>加重</option></select></div>
      <div class="field"><label>安全性评价</label><select name="clinician_safety"><option>未见明显不良反应</option><option>轻度不良反应</option><option>中度不良反应</option><option>重度不良反应</option></select></div>
      <div class="field full"><label>评价备注</label><textarea name="clinician_note"></textarea></div>
      <div class="field full"><button class="primary" type="submit"><i class="fa fa-save"></i> 保存评价</button></div>
    </form>
  `;
}

function renderPatientEditForm(patient) {
  return `
    <form id="patientEditForm" class="form-grid">
      <div class="field"><label>姓名</label><input name="name" value="${e(patient.name)}" required></div>
      <div class="field"><label>性别</label><select name="sex">${["男", "女", "其他"].map((value) => `<option ${value === patient.sex ? "selected" : ""}>${value}</option>`).join("")}</select></div>
      <div class="field"><label>年龄</label><input name="age" type="number" min="0" max="120" value="${e(patient.age)}" required></div>
      <div class="field"><label>中医诊断</label><input name="diagnosis" value="${e(patient.diagnosis)}" required></div>
      <div class="field"><label>证型</label><input name="tcm_syndrome" value="${e(patient.tcm_syndrome)}" required></div>
      <label class="check-row"><input name="consent_signed" type="checkbox" ${patient.consent_signed ? "checked" : ""}> 已签署知情同意</label>
      <div class="field full"><label>备注</label><textarea name="notes">${e(patient.notes || "")}</textarea></div>
      <div class="field full"><button class="btn" type="submit"><i class="fa fa-save"></i> 保存档案</button></div>
    </form>
  `;
}

function renderEvaluations(evaluations) {
  if (!evaluations || !evaluations.length) return `<div class="empty">暂无医生疗效评价</div>`;
  return evaluations.map((item) => `
    <form class="panel evaluation-edit-form" data-evaluation-id="${item.id}">
      <div class="panel-header">
        <h3 class="panel-title">${e(item.evaluation_date)} · ${e(item.clinician_effect)}</h3>
        <span>${App.pill(e(item.clinician_safety), item.clinician_safety.includes("重度") ? "danger" : item.clinician_safety.includes("中度") ? "warn" : "ok")}</span>
      </div>
      <div class="form-grid">
        <div class="field"><label>评价日期</label><input name="evaluation_date" type="date" value="${e(item.evaluation_date)}" required></div>
        <div class="field"><label>疗效评价</label><select name="clinician_effect">${["暂未评价", "显效", "有效", "无效", "加重"].map((value) => `<option ${value === item.clinician_effect ? "selected" : ""}>${value}</option>`).join("")}</select></div>
        <div class="field"><label>安全性评价</label><select name="clinician_safety">${["未见明显不良反应", "轻度不良反应", "中度不良反应", "重度不良反应"].map((value) => `<option ${value === item.clinician_safety ? "selected" : ""}>${value}</option>`).join("")}</select></div>
        <div class="field full"><label>评价备注</label><textarea name="clinician_note">${e(item.clinician_note || "")}</textarea></div>
        <div class="field full"><button class="btn" type="submit"><i class="fa fa-save"></i> 更新评价</button></div>
      </div>
      <div class="muted mt-2">评价医生：${e(item.evaluator_name || "")} · 更新时间：${e(item.updated_at || item.created_at || "")}</div>
    </form>
  `).join("");
}

async function loadQr(id) {
  const holder = document.getElementById("qrHolder");
  const linkNode = document.getElementById("followupLink");
  if (!holder || !linkNode) return;
  try {
    const data = await App.api(`/api/patients/${id}/qrcode`);
    if (data.disabled) {
      holder.innerHTML = `<div class="empty">随访链接已禁用</div>`;
      linkNode.value = "";
      linkNode.dataset.qrDataUrl = "";
      return;
    }
    holder.innerHTML = `<img class="qr" src="${data.dataUrl}" alt="患者随访二维码">`;
    linkNode.value = data.link;
    linkNode.dataset.qrDataUrl = data.dataUrl;
  } catch (error) {
    holder.innerHTML = `<div class="empty">二维码生成失败</div>`;
  }
}

function renderDetail(data) {
  const { patient, schedules, followups, notes, risks, evaluations } = data;
  document.getElementById("patientDetail").innerHTML = `
    <div class="panel-header">
      <div>
        <h2 class="panel-title">${e(patient.name)} <span class="muted">${e(patient.research_id || patient.patient_id)}</span></h2>
        <div class="muted">${e(patient.sex)} / ${e(patient.age)}岁 · ${e(patient.diagnosis)} · ${e(patient.tcm_syndrome)} · 手机 ${e(patient.phone_masked || "未填写")}</div>
      </div>
      <span>${patient.consent_signed ? App.pill("已签署知情同意", "ok") : App.pill("知情同意待补", "warn")} ${patient.token_disabled ? App.pill("链接已禁用", "danger") : App.pill("链接有效", "ok")}</span>
    </div>

    <div class="grid cols-3">
      <div class="panel metric"><span class="label">开始用药日期</span><span class="value" style="font-size:24px">${e(patient.medication_start_date)}</span></div>
      <div class="panel metric"><span class="label">随访记录</span><span class="value">${followups.length}</span></div>
      <div class="panel metric"><span class="label">不良反应</span><span class="value">${followups.filter((item) => item.has_adverse_reaction).length}</span></div>
    </div>

    <div class="section">${renderProgress(schedules)}</div>

    <div class="section panel">
      <div class="panel-header">
        <h3 class="panel-title">患者档案维护</h3>
        <span class="muted">研究编号：${e(patient.research_id || patient.patient_id)}</span>
      </div>
      ${renderPatientEditForm(patient)}
    </div>

    <div class="section grid cols-2">
      <div>
        <h3 class="panel-title mb-3">风险预警</h3>
        <div class="grid">${renderRisks(risks)}</div>
      </div>
      <div>
        <h3 class="panel-title mb-3">患者随访链接</h3>
        <div class="grid">
          <div class="notice ok"><i class="fa fa-link"></i><div><strong>随访链接状态：</strong>${patient.token_disabled ? "已禁用" : "有效"}${patient.token_disabled_at ? ` · ${e(patient.token_disabled_at)}` : ""}</div></div>
          <div id="qrHolder"><div class="empty">正在生成二维码</div></div>
          <div class="field">
            <input id="followupLink" readonly>
          </div>
          <div class="flex flex-wrap gap-2">
            <button id="copyLink" class="btn" type="button"><i class="fa fa-copy"></i> 复制链接</button>
            <button id="openPatientPage" class="btn" type="button"><i class="fa fa-external-link"></i> 打开患者页</button>
            <button id="printQr" class="btn" type="button"><i class="fa fa-print"></i> 打印二维码</button>
            <button id="toggleToken" class="btn ${patient.token_disabled ? "" : "danger"}" type="button">
              <i class="fa ${patient.token_disabled ? "fa-unlock" : "fa-ban"}"></i> ${patient.token_disabled ? "启用链接" : "禁用链接"}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <h3 class="panel-title mb-3">睡眠、焦虑、抑郁、心烦趋势</h3>
      <div style="height:320px">${followups.length ? `<canvas id="scoreChart"></canvas>` : `<div class="empty">暂无趋势数据</div>`}</div>
    </div>

    <div class="section">
      <h3 class="panel-title mb-3">量表与依从性趋势</h3>
      <div style="height:320px">${followups.length ? `<canvas id="scaleChart"></canvas>` : `<div class="empty">暂无量表趋势数据</div>`}</div>
    </div>

    <div class="section panel">
      <div class="panel-header">
        <h3 class="panel-title">医生疗效评价</h3>
      </div>
      ${renderEvaluationForm(patient.id)}
      <div class="section grid">${renderEvaluations(evaluations || [])}</div>
    </div>

    <div class="section grid cols-2">
      <div>
        <div class="panel-header">
          <h3 class="panel-title">随访计划</h3>
        </div>
        ${renderSchedules(schedules)}
        <form id="customScheduleForm" class="form-grid mt-4">
          <div class="field"><label>自定义节点</label><input name="label" placeholder="如：第42天电话随访"></div>
          <div class="field"><label>日期</label><input name="due_date" type="date" required></div>
          <div class="field"><label>&nbsp;</label><button class="btn" type="submit"><i class="fa fa-calendar-plus-o"></i> 添加</button></div>
        </form>
      </div>
      <div>
        <h3 class="panel-title mb-3">医生备注</h3>
        <form id="noteForm" class="grid mb-4">
          <textarea name="note" required></textarea>
          <button class="primary" type="submit"><i class="fa fa-pencil"></i> 添加备注</button>
        </form>
        <div class="grid">${renderNotes(notes)}</div>
      </div>
    </div>

    <div class="section">
      <h3 class="panel-title mb-3">医生处理记录时间线</h3>
      <div class="grid">${renderHandlingTimeline(followups, notes)}</div>
    </div>

    <div class="section">
      <h3 class="panel-title mb-3">随访记录</h3>
      ${renderFollowups(followups)}
    </div>

    <div class="section">
      <h3 class="panel-title mb-3">不良反应列表与处理</h3>
      <div class="grid">${renderAdverse(followups)}</div>
    </div>
  `;

  renderTrend(followups);
  renderScaleTrend(followups);
  loadQr(patient.id);
  bindDetailHandlers(patient.id);
}

function bindDetailHandlers(patientId) {
  const scheduleForm = document.getElementById("customScheduleForm");
  if (scheduleForm) {
    scheduleForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const done = App.setButtonBusy(event.submitter, "添加中");
      try {
        await App.api(`/api/patients/${patientId}/schedules`, {
          method: "POST",
          body: JSON.stringify(App.formJSON(event.currentTarget))
        });
        App.toast("随访节点已添加");
        await viewPatient(patientId);
      } catch (error) {
        App.toast(error.message);
      } finally {
        done();
      }
    });
  }

  const noteForm = document.getElementById("noteForm");
  if (noteForm) {
    noteForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const done = App.setButtonBusy(event.submitter, "保存中");
      try {
        await App.api(`/api/patients/${patientId}/notes`, {
          method: "POST",
          body: JSON.stringify(App.formJSON(event.currentTarget))
        });
        App.toast("备注已保存");
        await viewPatient(patientId);
      } catch (error) {
        App.toast(error.message);
      } finally {
        done();
      }
    });
  }

  const evaluationForm = document.getElementById("evaluationForm");
  if (evaluationForm) {
    evaluationForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const done = App.setButtonBusy(event.submitter, "保存中");
      try {
        await App.api(`/api/patients/${patientId}/evaluations`, {
          method: "POST",
          body: JSON.stringify(App.formJSON(event.currentTarget))
        });
        App.toast("医生评价已保存");
        await viewPatient(patientId);
      } catch (error) {
        App.toast(error.message);
      } finally {
        done();
      }
    });
  }

  const patientEditForm = document.getElementById("patientEditForm");
  if (patientEditForm) {
    patientEditForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const done = App.setButtonBusy(event.submitter, "保存中");
      try {
        await App.api(`/api/patients/${patientId}`, {
          method: "PUT",
          body: JSON.stringify(App.formJSON(event.currentTarget))
        });
        App.toast("患者档案已更新");
        await loadPatients();
        await viewPatient(patientId);
      } catch (error) {
        App.toast(error.message);
      } finally {
        done();
      }
    });
  }

  document.querySelectorAll(".evaluation-edit-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const done = App.setButtonBusy(event.submitter, "更新中");
      try {
        await App.api(`/api/patients/${patientId}/evaluations/${event.currentTarget.dataset.evaluationId}`, {
          method: "PUT",
          body: JSON.stringify(App.formJSON(event.currentTarget))
        });
        App.toast("医生评价已更新");
        await viewPatient(patientId);
      } catch (error) {
        App.toast(error.message);
      } finally {
        done();
      }
    });
  });

  const copyButton = document.getElementById("copyLink");
  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      const value = document.getElementById("followupLink").value;
      if (!value) {
        App.toast("当前随访链接已禁用");
        return;
      }
      await navigator.clipboard.writeText(value);
      App.toast("随访链接已复制");
    });
  }

  const openButton = document.getElementById("openPatientPage");
  if (openButton) {
    openButton.addEventListener("click", () => {
      const value = document.getElementById("followupLink").value;
      if (!value) {
        App.toast("当前随访链接已禁用");
        return;
      }
      window.open(value, "_blank", "noopener,noreferrer");
    });
  }

  const printButton = document.getElementById("printQr");
  if (printButton) {
    printButton.addEventListener("click", () => {
      const linkNode = document.getElementById("followupLink");
      const value = linkNode.value;
      const qrDataUrl = linkNode.dataset.qrDataUrl;
      if (!value || !qrDataUrl) {
        App.toast("当前随访链接已禁用");
        return;
      }
      const printWindow = window.open("", "_blank", "width=720,height=760");
      if (!printWindow) {
        App.toast("浏览器阻止了打印窗口，请允许弹出窗口后重试");
        return;
      }
      printWindow.document.write(`
        <!doctype html>
        <html lang="zh-CN">
        <head>
          <meta charset="utf-8">
          <title>患者随访二维码</title>
          <style>
            body { font-family: "Microsoft YaHei", Arial, sans-serif; padding: 32px; color: #1f2a24; }
            .card { border: 1px solid #d9ded6; border-radius: 12px; padding: 28px; width: 520px; }
            img { width: 260px; height: 260px; display: block; margin: 18px auto; }
            .link { word-break: break-all; color: #475569; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>患者专属随访二维码</h1>
            <p>请患者扫码进入本人随访页面，确认知情同意后填写随访。</p>
            <img src="${qrDataUrl}" alt="患者随访二维码">
            <p class="link">${e(value)}</p>
          </div>
          <script>window.onload = () => window.print();<\/script>
        </body>
        </html>
      `);
      printWindow.document.close();
    });
  }

  const toggleToken = document.getElementById("toggleToken");
  if (toggleToken) {
    toggleToken.addEventListener("click", async () => {
      const disabledNow = toggleToken.textContent.includes("启用");
      try {
        await App.api(`/api/patients/${patientId}/token`, {
          method: "PATCH",
          body: JSON.stringify({ disabled: disabledNow ? 0 : 1 })
        });
        App.toast(disabledNow ? "随访链接已启用" : "随访链接已禁用");
        await viewPatient(patientId);
        await loadPatients();
      } catch (error) {
        App.toast(error.message);
      }
    });
  }

  document.querySelectorAll(".adverse-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const done = App.setButtonBusy(event.submitter, "保存中");
      try {
        const id = event.currentTarget.dataset.followupId;
        await App.api(`/api/followups/${id}/doctor`, {
          method: "PUT",
          body: JSON.stringify(App.formJSON(event.currentTarget))
        });
        App.toast("处理记录已更新");
        await viewPatient(patientId);
      } catch (error) {
        App.toast(error.message);
      } finally {
        done();
      }
    });
  });
}

async function viewPatient(id) {
  selectedPatientId = Number(id);
  renderPatientList();
  const data = await App.api(`/api/patients/${id}`);
  renderDetail(data);
}

document.addEventListener("DOMContentLoaded", async () => {
  doctorUser = await App.requireAuth(["doctor", "admin"]);
  if (!doctorUser) return;
  App.bindLogout();
  document.querySelector('[name="medication_start_date"]').value = new Date().toISOString().slice(0, 10);
  await loadPatients();

  document.getElementById("reloadPatients").addEventListener("click", () => {
    loadPatients().catch((error) => App.toast(error.message));
  });

  document.getElementById("quickFilterGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    patientFilter = patientFilter === button.dataset.filter ? "all" : button.dataset.filter;
    renderQuickFilters();
    renderPatientList();
  });

  document.getElementById("patientList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-patient-id]");
    if (!button) return;
    viewPatient(button.dataset.patientId).catch((error) => App.toast(error.message));
  });

  document.getElementById("patientForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const done = App.setButtonBusy(event.submitter, "创建中");
    try {
      const data = await App.api("/api/patients", {
        method: "POST",
        body: JSON.stringify(App.formJSON(event.currentTarget))
      });
      event.currentTarget.reset();
      document.querySelector('[name="medication_start_date"]').value = new Date().toISOString().slice(0, 10);
      App.toast("患者档案已创建");
      await loadPatients();
      await viewPatient(data.patient.id);
    } catch (error) {
      App.toast(error.message);
    } finally {
      done();
    }
  });
});
