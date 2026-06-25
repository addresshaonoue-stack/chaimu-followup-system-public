const dayjs = require("dayjs");
const { initDb, all, get, run, transaction } = require("./db");

const names = [
  "林清和", "钱雅婷", "孙明远", "李若溪", "周安宁",
  "吴思远", "郑雨晴", "王嘉禾", "冯晓岚", "陈景行",
  "褚佳怡", "卫子墨", "蒋舒然", "沈浩然", "韩青禾",
  "杨知远", "朱沁宁", "秦沐阳", "尤安澜", "许星河"
];

const visitOrder = {
  "第0天基线": 0,
  "第7天": 1,
  "第14天": 2,
  "第28天": 3,
  "第56天": 4,
  "第84天": 5
};

const missingVisitMap = new Map([
  [5, [1, 2, 3, 4, 5]],
  [8, [2, 3, 4, 5]],
  [11, [3, 4, 5]],
  [14, [4, 5]],
  [17, [5]]
]);

const missedDosePatients = new Set([3, 12, 18]);

function shouldSkipFollowup(patientIndex, visitIndex) {
  return (missingVisitMap.get(patientIndex) || []).includes(visitIndex);
}

function researchCode(index) {
  return `CMKY-${dayjs().format("YYYY")}-${String(index).padStart(4, "0")}`;
}

function score(base, visitIndex, patientIndex, metricOffset = 0) {
  const improvement = [0, 1, 2, 3, 4, 5][visitIndex] || visitIndex;
  const wave = ((patientIndex + visitIndex + metricOffset) % 4 === 0 ? 1 : 0)
    + ((patientIndex === 8 && visitIndex === 3) ? 2 : 0)
    + ((patientIndex === 13 && visitIndex === 4) ? 2 : 0)
    + ((patientIndex === 17 && visitIndex === 2) ? 1 : 0)
    - ((patientIndex + metricOffset) % 7 === 0 && visitIndex >= 4 ? 1 : 0);
  return Math.max(0, Math.min(10, Math.round(base - improvement + wave)));
}

function insertFollowup(patient, schedule, patientIndex, visitIndex, override = {}) {
  const base = 6 + (patientIndex % 3);
  const hasAdverse = false;
  const severity = null;
  const selfDiscontinued = 0;
  const missedDoses = missedDosePatients.has(patientIndex) && visitIndex >= 2 && visitIndex <= 4
    ? ((patientIndex + visitIndex) % 2) + 1
    : 0;
  const label = override.label || schedule.label;
  const visitDate = override.visit_date || schedule.due_date;
  const scaleIndex = Math.max(0, Math.min(5, visitIndex));
  const psqiPatterns = [
    [2, 2, 2, 2, 2],
    [2, 2, 2, 2, 2],
    [2, 2, 2, 1, 2],
    [2, 1, 2, 1, 2],
    [1, 1, 2, 1, 1],
    [1, 1, 1, 1, 1]
  ];
  const gad7Patterns = [
    [2, 2, 2, 2, 2, 2, 2],
    [2, 2, 2, 2, 2, 2, 1],
    [2, 1, 2, 1, 2, 1, 2],
    [1, 1, 2, 1, 1, 1, 2],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 0, 0]
  ];
  const phq9Patterns = [
    [2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 2, 2, 2, 2, 2, 2, 1, 2],
    [2, 2, 1, 2, 1, 2, 1, 2, 1],
    [1, 2, 1, 1, 1, 2, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 0, 0, 0]
  ];
  function waveItems(items, modulo) {
    return items.map((value, idx) => {
      const upward = (patientIndex + idx + visitIndex) % modulo === 0 ? 1 : 0;
      const downward = (patientIndex + idx) % 17 === 0 && visitIndex >= 4 ? 1 : 0;
      return Math.max(0, Math.min(3, value + upward - downward));
    });
  }
  const psqi = waveItems(psqiPatterns[scaleIndex], 4);
  const gad7 = waveItems(gad7Patterns[scaleIndex], 5);
  const phq9 = waveItems(phq9Patterns[scaleIndex], 7);
  const adherenceScore = (missedDoses > 0 ? 0 : 1)
    + 1
    + 1
    + 1;
  const adherenceLevel = adherenceScore >= 4 ? "高依从性" : adherenceScore >= 2 ? "中等依从性" : "低依从性";
  const gad7Score = gad7.reduce((sum, value) => sum + value, 0);
  const phq9Score = phq9.reduce((sum, value) => sum + value, 0);

  run(`
    INSERT INTO followups (
      patient_id, schedule_id, visit_label, visit_date,
      on_time_medication, missed_doses, self_discontinued,
      sleep_score, sleep_difficulty, early_wake, vivid_dreams, sleep_hours,
      psqi_sleep_latency, psqi_night_wake, psqi_early_wake, psqi_sleep_duration,
      psqi_day_fatigue, psqi_simple_score,
      anxiety_score, depression_score, irritability_score, low_mood_score,
      gad7_1, gad7_2, gad7_3, gad7_4, gad7_5, gad7_6, gad7_7, gad7_score, gad7_level,
      phq9_1, phq9_2, phq9_3, phq9_4, phq9_5, phq9_6, phq9_7, phq9_8, phq9_9, phq9_score, phq9_level,
      chest_tightness, palpitation, dizziness, bitter_mouth, dry_mouth, fatigue,
      adherence_forget, adherence_stop_better, adherence_stop_discomfort, adherence_regular,
      adherence_score, adherence_level,
      has_adverse_reaction, adverse_type, severity, stopped_due_adverse,
      sought_medical_help, adverse_description, patient_note, doctor_note,
      doctor_handling_status, doctor_handling_note
    ) VALUES (
      @patient_id, @schedule_id, @visit_label, @visit_date,
      @on_time_medication, @missed_doses, @self_discontinued,
      @sleep_score, @sleep_difficulty, @early_wake, @vivid_dreams, @sleep_hours,
      @psqi_sleep_latency, @psqi_night_wake, @psqi_early_wake, @psqi_sleep_duration,
      @psqi_day_fatigue, @psqi_simple_score,
      @anxiety_score, @depression_score, @irritability_score, @low_mood_score,
      @gad7_1, @gad7_2, @gad7_3, @gad7_4, @gad7_5, @gad7_6, @gad7_7, @gad7_score, @gad7_level,
      @phq9_1, @phq9_2, @phq9_3, @phq9_4, @phq9_5, @phq9_6, @phq9_7, @phq9_8, @phq9_9, @phq9_score, @phq9_level,
      @chest_tightness, @palpitation, @dizziness, @bitter_mouth, @dry_mouth, @fatigue,
      @adherence_forget, @adherence_stop_better, @adherence_stop_discomfort, @adherence_regular,
      @adherence_score, @adherence_level,
      @has_adverse_reaction, @adverse_type, @severity, @stopped_due_adverse,
      @sought_medical_help, @adverse_description, @patient_note, @doctor_note,
      @doctor_handling_status, @doctor_handling_note
    )
  `, {
    patient_id: patient.id,
    schedule_id: override.schedule_id === null ? null : schedule.id,
    visit_label: label,
    visit_date: visitDate,
    on_time_medication: selfDiscontinued ? 0 : 1,
    missed_doses: missedDoses,
    self_discontinued: selfDiscontinued,
    sleep_score: score(base, visitIndex, patientIndex, 0),
    sleep_difficulty: visitIndex < 2 ? 1 : 0,
    early_wake: patientIndex % 2,
    vivid_dreams: patientIndex % 4 === 0 ? 1 : 0,
    sleep_hours: Math.max(3.5, Math.round((5 + visitIndex * 0.42 - (patientIndex % 3) * 0.15 + (patientIndex % 4 === 0 ? -0.25 : 0)) * 10) / 10),
    psqi_sleep_latency: psqi[0],
    psqi_night_wake: psqi[1],
    psqi_early_wake: psqi[2],
    psqi_sleep_duration: psqi[3],
    psqi_day_fatigue: psqi[4],
    psqi_simple_score: psqi.reduce((sum, value) => sum + value, 0),
    anxiety_score: score(base - 1, visitIndex, patientIndex, 1),
    depression_score: score(base - 1, visitIndex, patientIndex, 2),
    irritability_score: score(base, visitIndex, patientIndex, 3),
    low_mood_score: score(base - 1, visitIndex, patientIndex, 4),
    gad7_1: gad7[0],
    gad7_2: gad7[1],
    gad7_3: gad7[2],
    gad7_4: gad7[3],
    gad7_5: gad7[4],
    gad7_6: gad7[5],
    gad7_7: gad7[6],
    gad7_score: gad7Score,
    gad7_level: gad7Score <= 4 ? "正常或轻微" : gad7Score <= 9 ? "轻度" : gad7Score <= 14 ? "中度" : "重度",
    phq9_1: phq9[0],
    phq9_2: phq9[1],
    phq9_3: phq9[2],
    phq9_4: phq9[3],
    phq9_5: phq9[4],
    phq9_6: phq9[5],
    phq9_7: phq9[6],
    phq9_8: phq9[7],
    phq9_9: phq9[8],
    phq9_score: phq9Score,
    phq9_level: phq9Score <= 4 ? "正常或轻微" : phq9Score <= 9 ? "轻度" : phq9Score <= 14 ? "中度" : phq9Score <= 19 ? "中重度" : "重度",
    chest_tightness: score(6, visitIndex, patientIndex, 5),
    palpitation: score(5, visitIndex, patientIndex, 6),
    dizziness: score(4, visitIndex, patientIndex, 7),
    bitter_mouth: score(5, visitIndex, patientIndex, 8),
    dry_mouth: score(5, visitIndex, patientIndex, 9),
    fatigue: score(6, visitIndex, patientIndex, 10),
    adherence_forget: missedDoses > 0 ? 1 : 0,
    adherence_stop_better: selfDiscontinued ? 1 : 0,
    adherence_stop_discomfort: severity === "中" ? 1 : 0,
    adherence_regular: selfDiscontinued ? 0 : 1,
    adherence_score: adherenceScore,
    adherence_level: adherenceLevel,
    has_adverse_reaction: hasAdverse ? 1 : 0,
    adverse_type: "",
    severity,
    stopped_due_adverse: 0,
    sought_medical_help: 0,
    adverse_description: "",
    patient_note: override.label ? "第7天节点未按期填写，后续完成补访。" : (visitIndex === 0 ? "基线信息已填写。" : "本次随访已填写。"),
    doctor_note: "",
    doctor_handling_status: severity === "中" ? "已处理" : "无需处理",
    doctor_handling_note: ""
  });
}

async function main() {
  await initDb();
  const work = transaction(() => {
    run("DELETE FROM followups");
    run("DELETE FROM doctor_notes");
    run("DELETE FROM clinician_evaluations");
    run("DELETE FROM audit_logs");

    const patients = all("SELECT id, medication_start_date FROM patients ORDER BY id ASC");
    patients.forEach((patient, index) => {
      const patientIndex = index + 1;
      run(`
        UPDATE patients
        SET name = ?,
            sex = ?,
            research_id = ?,
            age = ?,
            diagnosis = '郁病',
            tcm_syndrome = '痰热内扰',
            consent_signed = ?,
            consent_time = ?,
            token_disabled = ?,
            token_disabled_at = CASE WHEN ? = 1 THEN datetime('now', 'localtime') ELSE NULL END,
            notes = ?,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [
        names[index] || `受试者${String(patientIndex).padStart(2, "0")}`,
        patientIndex % 2 === 0 ? "女" : "男",
        researchCode(patientIndex),
        28 + (patientIndex * 3) % 42,
        patientIndex % 6 === 0 ? 0 : 1,
        patientIndex % 6 === 0 ? null : dayjs(patient.medication_start_date).format("YYYY-MM-DD 09:00:00"),
        patientIndex === 20 ? 1 : 0,
        patientIndex === 20 ? 1 : 0,
        patientIndex % 6 === 0 ? "待补充纸质知情同意归档。" : "模拟真实世界随访患者资料。",
        patient.id
      ]);

      const schedules = all("SELECT id, label, due_date FROM followup_schedules WHERE patient_id = ? ORDER BY due_date ASC, id ASC", [patient.id]);
      schedules.forEach((schedule) => {
        const visitIndex = visitOrder[schedule.label] ?? 0;
        if (shouldSkipFollowup(patientIndex, visitIndex)) return;
        insertFollowup(patient, schedule, patientIndex, visitIndex);
      });

      if ([5, 8, 11].includes(patientIndex)) {
        const offset = patientIndex === 5 ? 10 : patientIndex === 8 ? 21 : 35;
        const visitIndex = patientIndex === 5 ? 1 : patientIndex === 8 ? 2 : 3;
        const schedule = schedules[visitIndex] || schedules[1];
        insertFollowup(patient, schedule, patientIndex, visitIndex, {
          schedule_id: null,
          label: "自定义补访",
          visit_date: dayjs(patient.medication_start_date).add(offset, "day").format("YYYY-MM-DD")
        });
      }

      if ([3, 12, 18].includes(patientIndex)) {
        run(`
          INSERT INTO doctor_notes (patient_id, doctor_id, note)
          SELECT ?, doctor_id, ?
          FROM patients
          WHERE id = ?
        `, [
          patient.id,
          "存在少量漏服记录，已提醒后续随访时继续核对服药依从性。",
          patient.id
        ]);
      }

      const clinicianEffect = patientIndex === 9 || patientIndex === 17 ? "无效" : patientIndex % 4 === 0 ? "显效" : "有效";
      const clinicianSafety = "未见明显不良反应";
      run(`
        INSERT INTO clinician_evaluations (
          patient_id, evaluation_date, clinician_effect, clinician_safety, clinician_note, evaluator_doctor
        )
        SELECT ?, ?, ?, ?, ?, doctor_id
        FROM patients
        WHERE id = ?
      `, [
        patient.id,
        dayjs(patient.medication_start_date).add(84, "day").format("YYYY-MM-DD"),
        clinicianEffect,
        clinicianSafety,
        `${researchCode(patientIndex)} 84天随访资料已完成医生评价记录。`,
        patient.id
      ]);

      run(`
        INSERT INTO audit_logs (actor_id, actor_name, actor_role, action_type, object_type, object_id, summary)
        SELECT doctor_id, '示例医生', 'doctor', '创建患者', 'patient', ?, ?
        FROM patients
        WHERE id = ?
      `, [
        researchCode(patientIndex),
        `规范化模拟患者：${researchCode(patientIndex)}`,
        patient.id
      ]);
    });

    run(`
      INSERT INTO audit_logs (actor_id, actor_name, actor_role, action_type, object_type, object_id, summary)
      SELECT id, display_name, role, '医生疗效评价', 'evaluation', 'demo-normalize', '规范化医生疗效评价示例数据'
      FROM users
      WHERE role = 'doctor'
      ORDER BY id ASC
      LIMIT 1
    `);

    return {
      patients: get("SELECT COUNT(*) AS count FROM patients").count,
      followups: get("SELECT COUNT(*) AS count FROM followups").count,
      evaluations: get("SELECT COUNT(*) AS count FROM clinician_evaluations").count,
      labels: all("SELECT visit_label, COUNT(*) AS count FROM followups GROUP BY visit_label ORDER BY MIN(visit_date)"),
      adverse: get("SELECT COUNT(*) AS count FROM followups WHERE has_adverse_reaction = 1").count,
      missedPatients: get("SELECT COUNT(DISTINCT patient_id) AS count FROM followups WHERE missed_doses > 0 OR on_time_medication = 0").count,
      missedRecords: get("SELECT COUNT(*) AS count FROM followups WHERE missed_doses > 0 OR on_time_medication = 0").count
    };
  });

  console.log(JSON.stringify(work(), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
