# 柴牡开郁颗粒真实世界随访系统部署说明

本系统支持两种运行模式：

- 本地开发模式：未设置 `DATABASE_URL` 时使用本地 `sql.js/SQLite` 文件数据库。
- 云端部署模式：设置 `DATABASE_URL` 后使用 PostgreSQL，适合 Render、Railway、Zeabur、腾讯云轻量服务器等环境。

系统边界：本系统仅用于医疗机构制剂用药随访、疗效观察、安全性记录和数据采集。不提供在线诊疗，不自动诊断，不自动开方，不调整用药剂量，不替代医生诊疗。正式临床使用前需通过医院伦理审批、信息安全审批和数据合规审查。

## 1. 环境变量

复制 `.env.example`，按实际环境填写：

```env
PORT=3000
DATABASE_URL=postgresql://user:password@host:5432/database
SESSION_SECRET=请填写足够长的随机字符串
NODE_ENV=production

ADMIN_USERNAME=admin_name
ADMIN_PASSWORD=请填写不少于8位的强密码
ADMIN_DISPLAY_NAME=系统管理员
ADMIN_DEPARTMENT=系统管理

PGSSLMODE=require
COOKIE_SECURE=true
```

说明：

- `DATABASE_URL`：云端 PostgreSQL 连接字符串。为空时使用本地 SQLite 文件。
- `SESSION_SECRET`：生产环境必须设置，不能使用默认值。
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`：首次启动时，如果用户表为空，系统会用这两个变量创建初始管理员。
- `DEMO_DOCTOR_USERNAME` / `DEMO_DOCTOR_PASSWORD`：仅在云端执行 `npm run init-db` 初始化演示数据时需要。

## 2. 本地运行

```bash
npm install
npm run init-db
npm start
```

访问：

- 首页：`http://localhost:3000/`
- 登录页：`http://localhost:3000/login.html`
- 医生工作台：`http://localhost:3000/doctor.html`
- 数据统计：`http://localhost:3000/research.html`

本地演示账号：

- 管理员：`admin / admin123`
- 医生：`doctor / doctor123`

## 3. Render 部署

1. 将项目推送到 Git 仓库。
2. 在 Render 创建 PostgreSQL 数据库。
3. 创建 Web Service，连接项目仓库。
4. Render 会读取项目中的 `render.yaml`，也可手动设置：
   - Build Command：`npm install`
   - Start Command：`npm start`
   - Health Check Path：`/health`
5. 配置环境变量：
   - `DATABASE_URL`：使用 Render PostgreSQL 的 Internal Database URL。
   - `SESSION_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `NODE_ENV=production`
6. 部署完成后访问 Render 分配的网址。

首次启动会自动创建数据库表，并在用户表为空时创建管理员账号。

## 4. Railway 部署

1. 在 Railway 创建项目并添加 PostgreSQL 服务。
2. 将本仓库作为应用服务导入。
3. Railway 会读取 `railway.json`，也可手动设置：
   - Build Command：`npm install`
   - Start Command：`npm start`
4. 配置环境变量：
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
   - `SESSION_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `NODE_ENV=production`
5. 部署完成后打开 Railway 提供的公网域名。

## 5. Zeabur 部署

1. 创建 Zeabur 项目。
2. 添加 PostgreSQL 服务。
3. 导入本项目仓库。
4. 使用 `zeabur.json` 中的启动配置，或手动设置：
   - Build Command：`npm install`
   - Start Command：`npm start`
5. 设置环境变量：
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `NODE_ENV=production`

## 6. 腾讯云轻量服务器部署

服务器建议配置：Ubuntu 22.04、Node.js 20 或 22、PostgreSQL 14+。

### 6.1 安装 Node.js 和 PostgreSQL

```bash
sudo apt update
sudo apt install -y curl git postgresql postgresql-contrib
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### 6.2 创建数据库

```bash
sudo -u postgres psql
```

在 PostgreSQL 控制台中执行：

```sql
CREATE DATABASE chaimu_followup;
CREATE USER chaimu_user WITH PASSWORD '请替换为强密码';
GRANT ALL PRIVILEGES ON DATABASE chaimu_followup TO chaimu_user;
\q
```

### 6.3 部署项目

```bash
git clone <你的仓库地址>
cd chaimu-followup-system
npm install
```

创建 `.env`：

```env
PORT=3000
DATABASE_URL=postgresql://chaimu_user:请替换为强密码@127.0.0.1:5432/chaimu_followup
SESSION_SECRET=请填写随机长字符串
ADMIN_USERNAME=admin_name
ADMIN_PASSWORD=请填写强密码
NODE_ENV=production
PGSSLMODE=disable
COOKIE_SECURE=false
```

启动：

```bash
npm start
```

生产环境建议使用 `pm2`：

```bash
sudo npm install -g pm2
pm2 start server/index.js --name chaimu-followup-system
pm2 save
pm2 startup
```

如需公网访问，请在腾讯云控制台放行 3000 端口，或使用 Nginx 反向代理到 HTTPS 域名。

## 7. 数据库初始化

生产环境推荐只初始化结构和管理员：

```bash
npm run db:init
```

实际上 `npm start` 也会自动建表，并在用户表为空时根据环境变量创建管理员。

## 8. 生成演示数据

本地演示：

```bash
npm run init-db
npm run normalize-demo-data
```

云端如果确实需要演示数据，请先设置：

```env
DEMO_DOCTOR_USERNAME=doctor_demo
DEMO_DOCTOR_PASSWORD=请填写强密码
```

然后执行：

```bash
npm run init-db
npm run normalize-demo-data
```

注意：`npm run init-db` 会重置数据库并生成模拟数据，不应用于已有真实数据的生产库。

## 9. 如何关闭模拟数据

正式环境不要执行：

```bash
npm run init-db
npm run normalize-demo-data
```

只运行：

```bash
npm run db:init
npm start
```

然后由管理员登录系统创建医生账号，由医生创建真实随访患者。

## 10. 数据库备份

### PostgreSQL 备份

```bash
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql
```

恢复：

```bash
psql "$DATABASE_URL" < backup_20260101_120000.sql
```

### 本地 SQLite/sql.js 备份

复制：

```text
data/chaimu_followup.sqlite
```

## 11. 验收路径

部署成功后访问：

- 首页：`/`
- 登录页：`/login.html`
- 医生工作台：`/doctor.html`
- 数据统计：`/research.html`
- 数据导出：`/export.html`
- 患者随访：医生端生成二维码或 token 链接后访问 `/patient.html?token=...`

## 12. 审批提醒

正式临床使用前，应完成：

- 医院伦理审批
- 信息安全审批
- 数据合规审查
- 账号、权限、日志、备份、脱敏导出流程确认
