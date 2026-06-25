PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS doctor_notes;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS clinician_evaluations;
DROP TABLE IF EXISTS followups;
DROP TABLE IF EXISTS followup_schedules;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS users;

PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'doctor')),
  display_name TEXT NOT NULL,
  department TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT NOT NULL UNIQUE,
  research_id TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  token_disabled INTEGER NOT NULL DEFAULT 0,
  token_disabled_at TEXT,
  name TEXT NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('男', '女', '其他')),
  age INTEGER NOT NULL CHECK (age BETWEEN 0 AND 120),
  phone TEXT,
  diagnosis TEXT NOT NULL,
  tcm_syndrome TEXT NOT NULL,
  medication_start_date TEXT NOT NULL,
  doctor_id INTEGER NOT NULL,
  consent_signed INTEGER NOT NULL DEFAULT 0,
  consent_time TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (doctor_id) REFERENCES users(id)
);

CREATE TABLE followup_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  due_date TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE (patient_id, label, due_date)
);

CREATE TABLE followups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  schedule_id INTEGER,
  visit_label TEXT NOT NULL,
  visit_date TEXT NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  on_time_medication INTEGER NOT NULL DEFAULT 1,
  missed_doses INTEGER NOT NULL DEFAULT 0,
  self_discontinued INTEGER NOT NULL DEFAULT 0,
  sleep_score INTEGER NOT NULL CHECK (sleep_score BETWEEN 0 AND 10),
  sleep_difficulty INTEGER NOT NULL DEFAULT 0,
  early_wake INTEGER NOT NULL DEFAULT 0,
  vivid_dreams INTEGER NOT NULL DEFAULT 0,
  sleep_hours REAL,
  psqi_sleep_latency INTEGER CHECK (psqi_sleep_latency IS NULL OR psqi_sleep_latency BETWEEN 0 AND 3),
  psqi_night_wake INTEGER CHECK (psqi_night_wake IS NULL OR psqi_night_wake BETWEEN 0 AND 3),
  psqi_early_wake INTEGER CHECK (psqi_early_wake IS NULL OR psqi_early_wake BETWEEN 0 AND 3),
  psqi_sleep_duration INTEGER CHECK (psqi_sleep_duration IS NULL OR psqi_sleep_duration BETWEEN 0 AND 3),
  psqi_day_fatigue INTEGER CHECK (psqi_day_fatigue IS NULL OR psqi_day_fatigue BETWEEN 0 AND 3),
  psqi_simple_score INTEGER CHECK (psqi_simple_score IS NULL OR psqi_simple_score BETWEEN 0 AND 15),
  anxiety_score INTEGER NOT NULL CHECK (anxiety_score BETWEEN 0 AND 10),
  depression_score INTEGER NOT NULL CHECK (depression_score BETWEEN 0 AND 10),
  irritability_score INTEGER NOT NULL CHECK (irritability_score BETWEEN 0 AND 10),
  low_mood_score INTEGER NOT NULL CHECK (low_mood_score BETWEEN 0 AND 10),
  gad7_1 INTEGER CHECK (gad7_1 IS NULL OR gad7_1 BETWEEN 0 AND 3),
  gad7_2 INTEGER CHECK (gad7_2 IS NULL OR gad7_2 BETWEEN 0 AND 3),
  gad7_3 INTEGER CHECK (gad7_3 IS NULL OR gad7_3 BETWEEN 0 AND 3),
  gad7_4 INTEGER CHECK (gad7_4 IS NULL OR gad7_4 BETWEEN 0 AND 3),
  gad7_5 INTEGER CHECK (gad7_5 IS NULL OR gad7_5 BETWEEN 0 AND 3),
  gad7_6 INTEGER CHECK (gad7_6 IS NULL OR gad7_6 BETWEEN 0 AND 3),
  gad7_7 INTEGER CHECK (gad7_7 IS NULL OR gad7_7 BETWEEN 0 AND 3),
  gad7_score INTEGER CHECK (gad7_score IS NULL OR gad7_score BETWEEN 0 AND 21),
  gad7_level TEXT,
  phq9_1 INTEGER CHECK (phq9_1 IS NULL OR phq9_1 BETWEEN 0 AND 3),
  phq9_2 INTEGER CHECK (phq9_2 IS NULL OR phq9_2 BETWEEN 0 AND 3),
  phq9_3 INTEGER CHECK (phq9_3 IS NULL OR phq9_3 BETWEEN 0 AND 3),
  phq9_4 INTEGER CHECK (phq9_4 IS NULL OR phq9_4 BETWEEN 0 AND 3),
  phq9_5 INTEGER CHECK (phq9_5 IS NULL OR phq9_5 BETWEEN 0 AND 3),
  phq9_6 INTEGER CHECK (phq9_6 IS NULL OR phq9_6 BETWEEN 0 AND 3),
  phq9_7 INTEGER CHECK (phq9_7 IS NULL OR phq9_7 BETWEEN 0 AND 3),
  phq9_8 INTEGER CHECK (phq9_8 IS NULL OR phq9_8 BETWEEN 0 AND 3),
  phq9_9 INTEGER CHECK (phq9_9 IS NULL OR phq9_9 BETWEEN 0 AND 3),
  phq9_score INTEGER CHECK (phq9_score IS NULL OR phq9_score BETWEEN 0 AND 27),
  phq9_level TEXT,
  chest_tightness INTEGER NOT NULL CHECK (chest_tightness BETWEEN 0 AND 10),
  palpitation INTEGER NOT NULL CHECK (palpitation BETWEEN 0 AND 10),
  dizziness INTEGER NOT NULL CHECK (dizziness BETWEEN 0 AND 10),
  bitter_mouth INTEGER NOT NULL CHECK (bitter_mouth BETWEEN 0 AND 10),
  dry_mouth INTEGER NOT NULL CHECK (dry_mouth BETWEEN 0 AND 10),
  fatigue INTEGER NOT NULL CHECK (fatigue BETWEEN 0 AND 10),
  adherence_forget INTEGER,
  adherence_stop_better INTEGER,
  adherence_stop_discomfort INTEGER,
  adherence_regular INTEGER,
  adherence_score INTEGER CHECK (adherence_score IS NULL OR adherence_score BETWEEN 0 AND 4),
  adherence_level TEXT,
  has_adverse_reaction INTEGER NOT NULL DEFAULT 0,
  adverse_type TEXT,
  severity TEXT CHECK (severity IS NULL OR severity IN ('轻', '中', '重')),
  stopped_due_adverse INTEGER NOT NULL DEFAULT 0,
  sought_medical_help INTEGER NOT NULL DEFAULT 0,
  adverse_description TEXT,
  patient_note TEXT,
  doctor_note TEXT,
  doctor_handling_status TEXT NOT NULL DEFAULT '未处理',
  doctor_handling_note TEXT,
  handled_by INTEGER,
  handled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (schedule_id) REFERENCES followup_schedules(id) ON DELETE SET NULL,
  FOREIGN KEY (handled_by) REFERENCES users(id)
);

CREATE TABLE clinician_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  evaluation_date TEXT NOT NULL,
  clinician_effect TEXT NOT NULL DEFAULT '暂未评价' CHECK (clinician_effect IN ('显效', '有效', '无效', '加重', '暂未评价')),
  clinician_safety TEXT NOT NULL DEFAULT '未见明显不良反应' CHECK (clinician_safety IN ('未见明显不良反应', '轻度不良反应', '中度不良反应', '重度不良反应')),
  clinician_note TEXT,
  evaluator_doctor INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (evaluator_doctor) REFERENCES users(id)
);

CREATE TABLE doctor_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  doctor_id INTEGER NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES users(id)
);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  actor_name TEXT,
  actor_role TEXT NOT NULL,
  action_type TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX idx_patients_doctor ON patients(doctor_id);
CREATE UNIQUE INDEX idx_patients_research_id ON patients(research_id);
CREATE INDEX idx_patients_token ON patients(token);
CREATE INDEX idx_patients_token_disabled ON patients(token_disabled);
CREATE INDEX idx_schedules_patient_due ON followup_schedules(patient_id, due_date);
CREATE INDEX idx_followups_patient_date ON followups(patient_id, visit_date);
CREATE INDEX idx_followups_schedule ON followups(schedule_id);
CREATE INDEX idx_followups_adverse ON followups(has_adverse_reaction, severity);
CREATE INDEX idx_evaluations_patient_date ON clinician_evaluations(patient_id, evaluation_date);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action_type, object_type);
