const { initDb, dialect } = require("./db");
const { bootstrapAdmin } = require("./bootstrap");

async function main() {
  await initDb();
  bootstrapAdmin();
  console.log(`数据库结构已初始化，当前模式：${dialect}`);
  if (process.env.DATABASE_URL) {
    console.log("已使用 PostgreSQL。");
  } else {
    console.log("未设置 DATABASE_URL，已使用本地 sql.js/SQLite 文件数据库。");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
