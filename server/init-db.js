const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const dayjs = require("dayjs");
const { DB_PATH, USE_POSTGRES, initDb, get, run, exec, transaction } = require("./db");

const initSql = fs.readFileSync(path.join(__dirname, "..", "init.sql"), "utf8");
const pgSchemaSql = fs.readFileSync(path.join(__dirname, "schema-postgres.sql"), "utf8");

const DEFAULT_SCHEDULES = [
  { label: "第0天基线", offset: 0 },
  { label: "第7天", offset: 7 },
  { label: "第14天", offset: 14 },
  { label: "第28天", offset: 28 },
  { label: "第56天", offset: 56 },
  { label: "第84天", offset: 84 }
];

const diagnoses = ["郁病"];
const syndromes = ["痰热内扰"];
const names = [
  "林清和", "钱雅婷", "孙明远", "李若溪", "周安宁",
  "吴思远", "郑雨晴", "王嘉禾", "冯晓岚", "陈景行",
  "褚佳怡", "卫子墨", "蒋舒然", "沈浩然", "韩青禾",
  "杨知远", "朱沁宁", "秦沐阳", "尤安澜", "许星河"
];

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

function randomToken() {
  return crypto.randomBytes(24).toString("hex");
}

function patientCode(index) {
  return `CMKY-${dayjs().format("YYYYMMDD")}-${String(index).padStart(3, "0")}`;
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
  const value = base - improvement + wave;
  return Math.max(0, Math.min(10, Math.round(value)));
}

function insertSchedule(patientDbId, startDate, label, offset, isCustom = 0) {
  return run(`
    INSERT INTO followup_schedules (patient_id, label, due_date, is_custom)
    VALUES (?, ?, ?, ?)
  `, [patientDbId, label, dayjs(startDate).add(offset, "day").format("YYYY-MM-DD"), isCustom]).lastID;
}

function insertFollowup(patientDbId, scheduleId, label, visitDate, patientIndex, visitIndex) {
  const base = 6 + (patientIndex % 3);
  const hasAdverse = false;
  const severity = null;
  const selfDiscontinued = 0;
  const missedDoses = missedDosePatients.has(patientIndex) && visitIndex >= 2 && visitIndex <= 4
    ? ((patientIndex + visitIndex) % 2) + 1
    : 0;
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
  const gad7Score = gad7.reduce((sum, value) => sum + value, 0);
  const phq9Score = phq9.reduce((sum, value) => sum + value, 0);
  const adherenceScore = (missedDoses > 0 ? 0 : 1) + 1 + 1 + 1;

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
      has_adverse_reaction, adverse_type, severity, stopped_due_adverse, sought_medical_help,
      adverse_description, patient_note, doctor_note, doctor_handling_status, doctor_handling_note
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
      @has_adverse_reaction, @adverse_type, @severity, @stopped_due_adverse, @sought_medical_help,
      @adverse_description, @patient_note, @doctor_note, @doctor_handling_status, @doctor_handling_note
    )
  `, {
    patient_id: patientDbId,
    schedule_id: scheduleId,
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
    adherence_level: adherenceScore >= 4 ? "高依从性" : adherenceScore >= 2 ? "中等依从性" : "低依从性",
    has_adverse_reaction: hasAdverse ? 1 : 0,
    adverse_type: null,
    severity,
    stopped_due_adverse: 0,
    sought_medical_help: 0,
    adverse_description: null,
    patient_note: visitIndex === 0 ? "基线信息已填写。" : "本次随访已填写。",
    doctor_note: "",
    doctor_handling_status: severity === "中" ? "已联系" : "已关闭",
    doctor_handling_note: ""
  });
}

async function main() {
  await initDb();

  const seed = transaction(() => {
    if (USE_POSTGRES) {
      exec(`
        DROP TABLE IF EXISTS session CASCADE;
        DROP TABLE IF EXISTS doctor_notes CASCADE;
        DROP TABLE IF EXISTS audit_logs CASCADE;
        DROP TABLE IF EXISTS clinician_evaluations CASCADE;
        DROP TABLE IF EXISTS followups CASCADE;
        DROP TABLE IF EXISTS followup_schedules CASCADE;
        DROP TABLE IF EXISTS patients CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
      `);
      exec(pgSchemaSql);
    } else {
      exec(initSql);
    }

    const allowLocalDefaults = !USE_POSTGRES && process.env.NODE_ENV !== "production";
    const adminUsername = process.env.ADMIN_USERNAME || (allowLocalDefaults ? "admin" : "");
    const adminPassword = process.env.ADMIN_PASSWORD || (allowLocalDefaults ? "admin123" : "");
    const doctorUsername = process.env.DEMO_DOCTOR_USERNAME || (allowLocalDefaults ? "doctor" : "");
    const doctorPassword = process.env.DEMO_DOCTOR_PASSWORD || (allowLocalDefaults ? "doctor123" : "");
    const adminDisplayName = process.env.ADMIN_DISPLAY_NAME || "系统管理员";
    const adminDepartment = process.env.ADMIN_DEPARTMENT || "科研管理";
    const doctorDisplayName = process.env.DEMO_DOCTOR_DISPLAY_NAME || "示例医生";
    const doctorDepartment = process.env.DEMO_DOCTOR_DEPARTMENT || "睡眠情志门诊";

    if (!adminUsername || !adminPassword || !doctorUsername || !doctorPassword) {
      throw new Error("云端或生产环境初始化演示数据时，请设置 ADMIN_USERNAME、ADMIN_PASSWORD、DEMO_DOCTOR_USERNAME、DEMO_DOCTOR_PASSWORD。");
    }

    const adminHash = bcrypt.hashSync(adminPassword, 10);
    const doctorHash = bcrypt.hashSync(doctorPassword, 10);

    run(`
      INSERT INTO users (username, password_hash, role, display_name, department)
      VALUES (?, ?, 'admin', ?, ?)
    `, [adminUsername, adminHash, adminDisplayName, adminDepartment]);

    const doctorId = run(`
      INSERT INTO users (username, password_hash, role, display_name, department)
      VALUES (?, ?, 'doctor', ?, ?)
    `, [doctorUsername, doctorHash, doctorDisplayName, doctorDepartment]).lastID;

    for (let i = 1; i <= 20; i += 1) {
      const startDate = dayjs().subtract(84 - i * 2, "day").format("YYYY-MM-DD");
      const patientDbId = run(`
        INSERT INTO patients (
          patient_id, research_id, token, name, sex, age, phone, diagnosis, tcm_syndrome,
          medication_start_date, doctor_id, consent_signed, consent_time, notes
        ) VALUES (
          @patient_id, @research_id, @token, @name, @sex, @age, @phone, @diagnosis, @tcm_syndrome,
          @medication_start_date, @doctor_id, @consent_signed, @consent_time, @notes
        )
      `, {
        patient_id: patientCode(i),
        research_id: researchCode(i),
        token: randomToken(),
        name: names[i - 1],
        sex: i % 2 === 0 ? "女" : "男",
        age: 28 + (i * 3) % 42,
        phone: i % 4 === 0 ? "" : `1380000${String(1000 + i).slice(-4)}`,
        diagnosis: diagnoses[i % diagnoses.length],
        tcm_syndrome: syndromes[i % syndromes.length],
        medication_start_date: startDate,
        doctor_id: doctorId,
        consent_signed: i % 3 === 0 ? 0 : 1,
        consent_time: i % 3 === 0 ? null : dayjs(startDate).format("YYYY-MM-DD 09:00:00"),
        notes: i % 3 === 0 ? "待补充纸质知情同意归档。" : "模拟患者资料。"
      }).lastID;

      const scheduleRows = DEFAULT_SCHEDULES.map((item) => ({
        id: insertSchedule(patientDbId, startDate, item.label, item.offset),
        label: item.label,
        due_date: dayjs(startDate).add(item.offset, "day").format("YYYY-MM-DD")
      }));

      for (let j = 0; j < scheduleRows.length; j += 1) {
        if (shouldSkipFollowup(i, j)) continue;
        insertFollowup(patientDbId, scheduleRows[j].id, scheduleRows[j].label, scheduleRows[j].due_date, i, j);
      }
      if ([5, 8, 11].includes(i)) {
        const offset = i === 5 ? 10 : i === 8 ? 21 : 35;
        insertFollowup(patientDbId, null, "自定义补访", dayjs(startDate).add(offset, "day").format("YYYY-MM-DD"), i, 1);
      }

      const clinicianEffect = i === 9 || i === 17 ? "暂未见明显改善" : i % 4 === 0 ? "明显改善" : "部分改善";
      const clinicianSafety = "未记录明显不良事件";
      run(`
        INSERT INTO clinician_evaluations (
          patient_id, evaluation_date, clinician_effect, clinician_safety, clinician_note, evaluator_doctor
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        patientDbId,
        dayjs(startDate).add(84, "day").format("YYYY-MM-DD"),
        clinicianEffect,
        clinicianSafety,
        `${researchCode(i)} 84天随访资料已完成医生评价记录。`,
        doctorId
      ]);

      run(`
        INSERT INTO audit_logs (actor_id, actor_name, actor_role, action_type, object_type, object_id, summary)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [doctorId, "示例医生", "doctor", "创建患者", "patient", researchCode(i), `初始化模拟患者：${researchCode(i)}`]);
    }

    run(`
      INSERT INTO audit_logs (actor_id, actor_name, actor_role, action_type, object_type, object_id, summary)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [doctorId, "示例医生", "doctor", "医生综合观察评价", "evaluation", "demo-seed", "初始化医生综合观察评价示例数据"]);

    const patientTotal = get("SELECT COUNT(*) AS count FROM patients").count;
    const followupTotal = get("SELECT COUNT(*) AS count FROM followups").count;
    return { patientTotal, followupTotal };
  });

  const result = seed();
  console.log(`数据库初始化完成：${USE_POSTGRES ? "PostgreSQL" : DB_PATH}`);
  console.log(`模拟患者：${result.patientTotal} 个`);
  console.log(`模拟随访：${result.followupTotal} 条`);
  if (!USE_POSTGRES && process.env.NODE_ENV !== "production") {
    console.log("本地演示账号：admin / admin123");
    console.log("本地医生账号：doctor / doctor123");
  } else {
    console.log("云端账号来自环境变量，不输出密码。");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

