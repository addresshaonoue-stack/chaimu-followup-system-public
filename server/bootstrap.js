const bcrypt = require("bcryptjs");
const { get, run, USE_POSTGRES } = require("./db");

function envText(name) {
  return String(process.env[name] || "").trim();
}

function bootstrapAdmin() {
  const existing = get("SELECT COUNT(*) AS count FROM users");
  if (Number(existing?.count || 0) > 0) return;

  const username = envText("ADMIN_USERNAME");
  const password = envText("ADMIN_PASSWORD");
  const displayName = envText("ADMIN_DISPLAY_NAME") || "系统管理员";
  const department = envText("ADMIN_DEPARTMENT") || "系统管理";

  if (!username || !password) {
    if (USE_POSTGRES || process.env.NODE_ENV === "production") {
      throw new Error("首次启动生产环境时必须设置 ADMIN_USERNAME 和 ADMIN_PASSWORD，用于创建初始管理员。");
    }
    return;
  }

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD 至少需要 8 位字符。");
  }

  run(`
    INSERT INTO users (username, password_hash, role, display_name, department)
    VALUES (?, ?, 'admin', ?, ?)
  `, [
    username,
    bcrypt.hashSync(password, 10),
    displayName,
    department
  ]);

  run(`
    INSERT INTO audit_logs (actor_id, actor_name, actor_role, action_type, object_type, object_id, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    null,
    displayName,
    "admin",
    "初始化管理员",
    "user",
    username,
    "根据环境变量创建初始管理员账号"
  ]);
}

module.exports = {
  bootstrapAdmin
};
