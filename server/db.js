const fs = require("fs");
const path = require("path");
require("./load-env");
const {
  Worker,
  isMainThread,
  parentPort,
  MessageChannel,
  receiveMessageOnPort
} = require("worker_threads");

const dataDir = path.join(__dirname, "..", "data");
const DB_PATH = process.env.DB_PATH || path.join(dataDir, "chaimu_followup.sqlite");
const DATABASE_URL = process.env.DATABASE_URL || "";
const USE_POSTGRES = Boolean(DATABASE_URL);

if (!isMainThread) {
  const { Pool, types } = require("pg");

  types.setTypeParser(20, (value) => Number(value));
  types.setTypeParser(1700, (value) => Number(value));

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.PGSSLMODE === "disable" || /localhost|127\.0\.0\.1/.test(DATABASE_URL)
      ? false
      : { rejectUnauthorized: false }
  });
  let txClient = null;

  function splitSql(sql) {
    const statements = [];
    let current = "";
    let quote = null;
    for (let i = 0; i < sql.length; i += 1) {
      const char = sql[i];
      const next = sql[i + 1];
      current += char;
      if (quote) {
        if (char === quote && next === quote) {
          current += next;
          i += 1;
        } else if (char === quote) {
          quote = null;
        }
      } else if (char === "'" || char === '"') {
        quote = char;
      } else if (char === ";") {
        const text = current.trim();
        if (text) statements.push(text.replace(/;$/, ""));
        current = "";
      }
    }
    const text = current.trim();
    if (text) statements.push(text);
    return statements;
  }

  function rewriteSql(sql) {
    return String(sql)
      .replace(/datetime\(\s*'now'\s*,\s*'localtime'\s*\)/gi, "CURRENT_TIMESTAMP")
      .replace(/datetime\(\s*'now'\s*\)/gi, "CURRENT_TIMESTAMP");
  }

  function prepareQuery(sql, params = []) {
    let text = rewriteSql(sql);
    const values = [];

    if (Array.isArray(params)) {
      let index = 0;
      text = text.replace(/\?/g, () => {
        values.push(params[index]);
        index += 1;
        return `$${values.length}`;
      });
    } else if (params && typeof params === "object") {
      const positions = new Map();
      text = text.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (match, key) => {
        const rawKey = Object.prototype.hasOwnProperty.call(params, key) ? key : match;
        if (!positions.has(rawKey)) {
          positions.set(rawKey, values.length + 1);
          values.push(params[rawKey]);
        }
        return `$${positions.get(rawKey)}`;
      });
    }

    return { text, values };
  }

  function withReturningId(sql) {
    if (/^\s*insert\s+into\s+/i.test(sql) && !/\breturning\b/i.test(sql)) {
      return `${sql.trim()} RETURNING id`;
    }
    return sql;
  }

  async function query(sql, params = []) {
    const prepared = prepareQuery(sql, params);
    const runner = txClient || pool;
    return runner.query(prepared.text, prepared.values);
  }

  async function handle(message) {
    if (message.op === "init") {
      const schemaPath = path.join(__dirname, "schema-postgres.sql");
      const schema = fs.readFileSync(schemaPath, "utf8");
      for (const statement of splitSql(schema)) {
        await pool.query(statement);
      }
      return { ok: true, dialect: "postgres" };
    }
    if (message.op === "exec") {
      for (const statement of splitSql(message.sql)) {
        await query(statement, message.params || []);
      }
      return { changes: 0 };
    }
    if (message.op === "all") {
      const result = await query(message.sql, message.params || []);
      return result.rows;
    }
    if (message.op === "get") {
      const result = await query(message.sql, message.params || []);
      return result.rows[0];
    }
    if (message.op === "run") {
      const result = await query(withReturningId(message.sql), message.params || []);
      return {
        lastID: result.rows && result.rows[0] && result.rows[0].id ? Number(result.rows[0].id) : 0,
        changes: Number(result.rowCount || 0)
      };
    }
    if (message.op === "begin") {
      txClient = await pool.connect();
      await txClient.query("BEGIN");
      return { ok: true };
    }
    if (message.op === "commit") {
      if (txClient) {
        await txClient.query("COMMIT");
        txClient.release();
        txClient = null;
      }
      return { ok: true };
    }
    if (message.op === "rollback") {
      if (txClient) {
        await txClient.query("ROLLBACK");
        txClient.release();
        txClient = null;
      }
      return { ok: true };
    }
    throw new Error(`未知数据库操作：${message.op}`);
  }

  parentPort.on("message", async (message) => {
    try {
      const result = await handle(message);
      message.port.postMessage({ result });
    } catch (error) {
      message.port.postMessage({
        error: {
          message: error.message,
          stack: error.stack
        }
      });
    } finally {
      const state = new Int32Array(message.sab);
      Atomics.store(state, 0, 1);
      Atomics.notify(state, 0);
      message.port.close();
    }
  });
  return;
}

const initSqlJs = require("sql.js");

let SQL = null;
let sqlite = null;
let pgWorker = null;
let initPromise = null;
let transactionDepth = 0;

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function locateFile(file) {
  return path.join(path.dirname(require.resolve("sql.js")), file);
}

function pgCall(op, payload = {}) {
  if (!pgWorker) {
    pgWorker = new Worker(__filename, {
      env: process.env
    });
  }
  const sab = new SharedArrayBuffer(4);
  const state = new Int32Array(sab);
  const { port1, port2 } = new MessageChannel();
  pgWorker.postMessage({ op, sab, port: port2, ...payload }, [port2]);
  Atomics.wait(state, 0, 0);
  const received = receiveMessageOnPort(port1);
  port1.close();
  if (!received || !received.message) {
    throw new Error("PostgreSQL 工作线程未返回结果");
  }
  if (received.message.error) {
    const error = new Error(received.message.error.message);
    error.stack = received.message.error.stack || error.stack;
    throw error;
  }
  return received.message.result;
}

async function initDb() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (USE_POSTGRES) {
      pgCall("init");
      return { dialect: "postgres" };
    }

    SQL = await initSqlJs({ locateFile });
    if (fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 0) {
      sqlite = new SQL.Database(fs.readFileSync(DB_PATH));
    } else {
      sqlite = new SQL.Database();
      persist();
    }
    sqlite.run("PRAGMA foreign_keys = ON;");
    migrateSchema();
    return sqlite;
  })();
  return initPromise;
}

function tableExists(tableName) {
  const stmt = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?");
  try {
    stmt.bind([tableName]);
    return stmt.step();
  } finally {
    stmt.free();
  }
}

function columnNames(tableName) {
  const stmt = sqlite.prepare(`PRAGMA table_info(${tableName});`);
  const names = new Set();
  try {
    while (stmt.step()) {
      names.add(stmt.getAsObject().name);
    }
  } finally {
    stmt.free();
  }
  return names;
}

function tableSql(tableName) {
  const stmt = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?");
  try {
    stmt.bind([tableName]);
    return stmt.step() ? String(stmt.getAsObject().sql || "") : "";
  } finally {
    stmt.free();
  }
}

function addColumnIfMissing(tableName, names, columnSql) {
  const columnName = columnSql.trim().split(/\s+/)[0];
  if (!names.has(columnName)) {
    sqlite.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql};`);
    names.add(columnName);
  }
}

function createClinicianEvaluationsTable() {
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS clinician_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      evaluation_date TEXT NOT NULL,
      clinician_effect TEXT NOT NULL DEFAULT '暂未评价',
      clinician_safety TEXT NOT NULL DEFAULT '未记录明显不良事件',
      clinician_note TEXT,
      evaluator_doctor INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (evaluator_doctor) REFERENCES users(id)
    );
  `);
}

function migrateClinicianSafetyConstraint() {
  const sql = tableSql("clinician_evaluations");
  if (!sql.includes("未见明显不良反应")) return;

  const legacyTable = "clinician_evaluations_legacy_migrate";
  try {
    sqlite.run("PRAGMA foreign_keys = OFF;");
    sqlite.run(`DROP TABLE IF EXISTS ${legacyTable};`);
    sqlite.run(`ALTER TABLE clinician_evaluations RENAME TO ${legacyTable};`);
    createClinicianEvaluationsTable();
    sqlite.run(`
      INSERT INTO clinician_evaluations (
        id, patient_id, evaluation_date, clinician_effect, clinician_safety,
        clinician_note, evaluator_doctor, created_at, updated_at
      )
      SELECT
        id,
        patient_id,
        evaluation_date,
        clinician_effect,
        CASE clinician_safety
          WHEN '未见明显不良反应' THEN '未记录明显不良事件'
          WHEN '轻度不良反应' THEN '轻度不良事件'
          WHEN '中度不良反应' THEN '中度不良事件'
          WHEN '重度不良反应' THEN '重度不良事件'
          ELSE clinician_safety
        END,
        clinician_note,
        evaluator_doctor,
        created_at,
        updated_at
      FROM ${legacyTable};
    `);
    sqlite.run(`DROP TABLE ${legacyTable};`);
  } finally {
    sqlite.run("PRAGMA foreign_keys = ON;");
  }
}

function migrateSchema() {
  if (!tableExists("patients")) return;

  const patientColumns = columnNames("patients");
  addColumnIfMissing("patients", patientColumns, "research_id TEXT");
  addColumnIfMissing("patients", patientColumns, "consent_time TEXT");
  addColumnIfMissing("patients", patientColumns, "token_disabled INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("patients", patientColumns, "token_disabled_at TEXT");

  const followupColumns = columnNames("followups");
  [
    "psqi_sleep_latency INTEGER",
    "psqi_night_wake INTEGER",
    "psqi_early_wake INTEGER",
    "psqi_sleep_duration INTEGER",
    "psqi_day_fatigue INTEGER",
    "psqi_simple_score INTEGER",
    "gad7_1 INTEGER",
    "gad7_2 INTEGER",
    "gad7_3 INTEGER",
    "gad7_4 INTEGER",
    "gad7_5 INTEGER",
    "gad7_6 INTEGER",
    "gad7_7 INTEGER",
    "gad7_score INTEGER",
    "gad7_level TEXT",
    "phq9_1 INTEGER",
    "phq9_2 INTEGER",
    "phq9_3 INTEGER",
    "phq9_4 INTEGER",
    "phq9_5 INTEGER",
    "phq9_6 INTEGER",
    "phq9_7 INTEGER",
    "phq9_8 INTEGER",
    "phq9_9 INTEGER",
    "phq9_score INTEGER",
    "phq9_level TEXT",
    "adherence_forget INTEGER",
    "adherence_stop_better INTEGER",
    "adherence_stop_discomfort INTEGER",
    "adherence_regular INTEGER",
    "adherence_score INTEGER",
    "adherence_level TEXT"
  ].forEach((columnSql) => addColumnIfMissing("followups", followupColumns, columnSql));

  createClinicianEvaluationsTable();
  migrateClinicianSafetyConstraint();

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
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
  `);

  sqlite.run(`
    UPDATE patients
    SET consent_time = COALESCE(consent_time, created_at)
    WHERE consent_signed = 1 AND consent_time IS NULL;
  `);

  sqlite.run(`
    UPDATE patients
    SET research_id = 'CMKY-2026-' || printf('%04d', id)
    WHERE research_id IS NULL OR research_id = '';
  `);

  sqlite.run(`
    UPDATE clinician_evaluations
    SET clinician_safety = CASE clinician_safety
      WHEN '未见明显不良反应' THEN '未记录明显不良事件'
      WHEN '轻度不良反应' THEN '轻度不良事件'
      WHEN '中度不良反应' THEN '中度不良事件'
      WHEN '重度不良反应' THEN '重度不良事件'
      ELSE clinician_safety
    END;
  `);

  sqlite.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_research_id ON patients(research_id);");
  sqlite.run("CREATE INDEX IF NOT EXISTS idx_evaluations_patient_date ON clinician_evaluations(patient_id, evaluation_date);");
  sqlite.run("CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);");
  sqlite.run("CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action_type, object_type);");
  persist(true);
}

function ensureReady() {
  if (USE_POSTGRES) return;
  if (!sqlite) {
    throw new Error("数据库尚未初始化，请先调用 initDb()");
  }
}

function persist(force = false) {
  if (!sqlite) return;
  if (transactionDepth > 0 && !force) return;
  const data = sqlite.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function normalizeParams(params) {
  if (Array.isArray(params)) return params;
  if (!params || typeof params !== "object") return [];

  const normalized = {};
  Object.entries(params).forEach(([key, value]) => {
    if (/^[$:@]/.test(key)) {
      normalized[key] = value;
    } else {
      normalized[`@${key}`] = value;
    }
  });
  return normalized;
}

function hasParams(params) {
  if (Array.isArray(params)) return params.length > 0;
  return params && typeof params === "object" && Object.keys(params).length > 0;
}

function getScalar(sql) {
  const stmt = sqlite.prepare(sql);
  try {
    return stmt.step() ? Object.values(stmt.getAsObject())[0] : null;
  } finally {
    stmt.free();
  }
}

function run(sql, params = []) {
  if (USE_POSTGRES) return pgCall("run", { sql, params });
  ensureReady();
  const stmt = sqlite.prepare(sql);
  try {
    if (hasParams(params)) {
      stmt.bind(normalizeParams(params));
    }
    stmt.step();
  } finally {
    stmt.free();
  }

  const result = {
    lastID: Number(getScalar("SELECT last_insert_rowid() AS id")),
    changes: Number(getScalar("SELECT changes() AS changes"))
  };
  persist();
  return result;
}

function all(sql, params = []) {
  if (USE_POSTGRES) return pgCall("all", { sql, params });
  ensureReady();
  const stmt = sqlite.prepare(sql);
  const rows = [];
  try {
    if (hasParams(params)) {
      stmt.bind(normalizeParams(params));
    }
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
  } finally {
    stmt.free();
  }
  return rows;
}

function get(sql, params = []) {
  if (USE_POSTGRES) return pgCall("get", { sql, params });
  return all(sql, params)[0];
}

function exec(sql, params = []) {
  if (USE_POSTGRES) return pgCall("exec", { sql, params });
  ensureReady();
  sqlite.exec(sql);
  persist();
  return { changes: 0 };
}

function transaction(fn) {
  return (...args) => {
    if (USE_POSTGRES) {
      pgCall("begin");
      try {
        const result = fn(...args);
        pgCall("commit");
        return result;
      } catch (error) {
        pgCall("rollback");
        throw error;
      }
    }

    ensureReady();
    sqlite.run("BEGIN IMMEDIATE TRANSACTION;");
    transactionDepth += 1;
    try {
      const result = fn(...args);
      transactionDepth -= 1;
      sqlite.run("COMMIT;");
      persist(true);
      return result;
    } catch (error) {
      transactionDepth -= 1;
      sqlite.run("ROLLBACK;");
      throw error;
    }
  };
}

module.exports = {
  DB_PATH,
  DATABASE_URL,
  USE_POSTGRES,
  dialect: USE_POSTGRES ? "postgres" : "sqlite",
  initDb,
  get,
  all,
  run,
  exec,
  transaction
};
