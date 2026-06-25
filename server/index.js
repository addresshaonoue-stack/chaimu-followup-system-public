const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");

const { initDb } = require("./db");
const { bootstrapAdmin } = require("./bootstrap");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const SESSION_SECRET = process.env.SESSION_SECRET || "";

if (IS_PRODUCTION && !SESSION_SECRET) {
  throw new Error("生产环境必须设置 SESSION_SECRET 环境变量。");
}

function createSessionStore() {
  if (!process.env.DATABASE_URL) return undefined;
  const PgSession = require("connect-pg-simple")(session);
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === "disable" || /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
      ? false
      : { rejectUnauthorized: false }
  });
  return new PgSession({
    pool,
    tableName: "session",
    createTableIfMissing: true
  });
}

app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: "chaimu.sid",
  store: createSessionStore(),
  secret: SESSION_SECRET || "local-dev-session-secret-change-before-use",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PRODUCTION && process.env.COOKIE_SECURE !== "false",
    maxAge: 8 * 60 * 60 * 1000
  }
}));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/patients", require("./routes/patients"));
app.use("/api/followups", require("./routes/followups"));
app.use("/api/research", require("./routes/research"));
app.use("/api/demo", require("./routes/demo"));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "chaimu-followup-system" });
});

app.use(express.static(path.join(__dirname, "..", "public")));

app.use((req, res) => {
  res.status(404).json({ error: "资源不存在" });
});

app.use((err, req, res, next) => {
  void next;
  console.error(err);
  res.status(500).json({ error: "服务器内部错误" });
});

async function start(port = PORT) {
  await initDb();
  bootstrapAdmin();
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      console.log(`柴牡开郁颗粒随访系统已启动：http://localhost:${actualPort}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("数据库初始化失败", error);
    process.exit(1);
  });
}

module.exports = {
  app,
  start
};
