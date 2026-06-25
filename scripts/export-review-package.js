const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const BASE_URL = process.env.REVIEW_BASE_URL || "http://127.0.0.1:3000";
const PACKAGE_DIR = path.join(ROOT, "review_package");
const ZIP_PATH = path.join(ROOT, "review_package.zip");
const SCREENSHOT_DIR = path.join(PACKAGE_DIR, "screenshots");
const HTML_DIR = path.join(PACKAGE_DIR, "html");
const DOCS_DIR = path.join(PACKAGE_DIR, "docs_snapshot");
const VIEWPORT = { width: 1440, height: 1000 };

const DOCS_TO_COPY = [
  "软件著作权说明书.md",
  "系统功能模块说明.md",
  "数据库设计说明.md",
  "数据质量控制说明.md",
  "真实世界研究方案简版.md",
  "用户使用手册.md",
  "管理员使用手册.md",
  "量表模块说明.md",
  "审计日志与数据安全说明.md",
  "脱敏导出说明.md",
  "二维码随访流程说明.md"
];

const FORBIDDEN_WORDS = [
  "评委",
  "比赛",
  "冲奖",
  "一等奖",
  "药品赛道",
  "第9级",
  "169例",
  "98.2%",
  "98.3%",
  "疗效显著",
  "保证有效",
  "治愈",
  "自动诊断",
  "自动开方",
  "剂量调整",
  "在线诊疗",
  "在线问诊",
  "互联网医院"
];

const MEDICAL_FUNCTION_WORDS = new Set(["自动诊断", "自动开方", "剂量调整", "在线诊疗", "在线问诊", "互联网医院"]);

const SIMULATED_NAMES = [
  "林清和",
  "钱雅婷",
  "孙明远",
  "李若溪",
  "周安宁",
  "吴思远",
  "郑雨晴",
  "王嘉禾",
  "冯晓岚",
  "陈景行",
  "褚佳怡",
  "卫子墨",
  "蒋舒然",
  "沈浩然",
  "韩青禾",
  "杨知远",
  "朱沁宁",
  "秦沐阳",
  "尤安澜",
  "许星河"
];

const PAGE_DEFINITIONS = [
  {
    key: "home",
    name: "首页",
    route: "/",
    requiresLogin: false,
    account: "",
    purpose: "展示系统定位、入口和真实世界随访闭环。",
    focus: "项目定位是否清楚，是否避免互联网诊疗和夸大疗效表述。"
  },
  {
    key: "demo",
    name: "展示页",
    route: "/demo.html",
    requiresLogin: false,
    account: "",
    purpose: "以图表化方式呈现数据闭环、核心指标和脱敏导出能力。",
    focus: "是否适合现场展示，核心指标是否直观，合规边界是否中性。"
  },
  {
    key: "demo_three_in_one",
    name: "三位一体成果闭环截图",
    route: "/demo.html",
    requiresLogin: false,
    account: "",
    keepScroll: true,
    action: async (page) => {
      await page.waitForSelector("#threeInOneLoop", { timeout: 10000 });
      await page.locator("#threeInOneLoop").scrollIntoViewIfNeeded();
    },
    purpose: "展示医疗机构制剂、海洋中药牡蛎和真实世界随访系统的成果闭环。",
    focus: "成果闭环是否表达清楚，文字是否保持中性。"
  },
  {
    key: "standalone_full",
    name: "完整静态系统页",
    route: "/standalone-demo.html#home",
    requiresLogin: false,
    account: "",
    purpose: "展示单文件 HTML 版本，保留管理员、医生、患者随访、数据统计、导出和审计日志等主要功能。",
    focus: "纯 HTML 版是否能完整呈现原系统流程，是否适合直接分发给外部查看。"
  },
  {
    key: "standalone_stats",
    name: "完整静态数据统计页",
    route: "/standalone-demo.html#home",
    requiresLogin: false,
    account: "",
    action: async (page) => {
      await page.evaluate(() => {
        localStorage.setItem("chaimu_static_auth_v1", JSON.stringify({
          id: 1,
          username: "admin",
          role: "admin",
          display_name: "系统管理员",
          department: "科研管理"
        }));
        window.location.hash = "stats";
      });
      await page.waitForTimeout(1200);
    },
    purpose: "展示完整静态版的数据统计、图表驾驶舱、单患者轨迹和脱敏导出入口。",
    focus: "静态数据统计页图表是否完整，是否默认脱敏，是否保留关键研究数据视图。"
  },
  {
    key: "login",
    name: "登录页",
    route: "/login.html",
    requiresLogin: false,
    account: "",
    purpose: "提供管理员和医生账号登录入口。",
    focus: "账号来源、管理员初始化方式和正式部署安全提示是否清晰。"
  },
  {
    key: "admin",
    name: "管理员后台",
    route: "/admin.html",
    requiresLogin: true,
    account: "admin / admin123",
    context: "admin",
    purpose: "管理医生账号、患者总览、审计日志和系统统计。",
    focus: "管理员是否能查看全量模拟数据，审计日志入口是否清楚。"
  },
  {
    key: "doctor",
    name: "医生工作台",
    route: "/doctor.html",
    requiresLogin: true,
    account: "doctor / doctor123",
    context: "doctor",
    purpose: "创建患者、查看本人管理患者、查看趋势、风险预警和医生评价。",
    focus: "患者管理闭环是否顺畅，趋势图、风险预警和二维码链接是否可见。"
  },
  {
    key: "doctor_quick_filters",
    name: "医生端快捷入口截图",
    route: "/doctor.html",
    requiresLogin: true,
    account: "doctor / doctor123",
    context: "doctor",
    purpose: "展示本次应随访、逾期随访和需关注患者快捷筛选入口。",
    focus: "医生端是否便于快速定位需要处理的患者。"
  },
  {
    key: "research",
    name: "数据统计页",
    route: "/research.html",
    requiresLogin: true,
    account: "admin / admin123",
    context: "admin",
    purpose: "图表化展示随访完成率、量表趋势、安全性记录和数据质量。",
    focus: "数据统计页是否默认脱敏，图表是否完整，数据摘要是否支持研究评估。"
  },
  {
    key: "export",
    name: "数据导出页",
    route: "/export.html",
    requiresLogin: true,
    account: "admin / admin123",
    context: "admin",
    purpose: "导出脱敏 CSV、脱敏 Excel 和数据统计数据。",
    focus: "导出字段是否完整，脱敏提示是否明确，是否避免真实隐私外泄。"
  }
];

function toUrl(route) {
  return new URL(route, BASE_URL).toString();
}

function rel(filePath) {
  return path.relative(PACKAGE_DIR, filePath).replace(/\\/g, "/");
}

function ensureCleanOutput() {
  fs.rmSync(PACKAGE_DIR, { recursive: true, force: true });
  fs.rmSync(ZIP_PATH, { force: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.mkdirSync(HTML_DIR, { recursive: true });
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function markdownFence(value) {
  return String(value ?? "").replace(/```/g, "'''");
}

function writeRenderedPageFile(filePath, pageInfo, bodyText, renderedHtml) {
  const content = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(pageInfo.name)} - 渲染内容导出</title>
  <style>
    body { font-family: "Microsoft YaHei", Arial, sans-serif; line-height: 1.65; color: #1f2937; padding: 28px; }
    h1, h2 { color: #111827; }
    pre { white-space: pre-wrap; word-break: break-word; background: #f8fafc; border: 1px solid #dbe3ea; border-radius: 8px; padding: 16px; }
    .meta { color: #64748b; margin-bottom: 22px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(pageInfo.name)}</h1>
  <div class="meta">路由：${escapeHtml(pageInfo.route)}</div>
  <h2>页面实际可见文字 body.innerText</h2>
  <pre>${escapeHtml(bodyText)}</pre>
  <h2>渲染后 HTML document.documentElement.outerHTML</h2>
  <pre>${escapeHtml(renderedHtml)}</pre>
</body>
</html>
`;
  fs.writeFileSync(filePath, content, "utf8");
}

async function checkService() {
  try {
    const response = await fetch(toUrl("/health"));
    if (!response.ok) {
      throw new Error(`服务健康检查返回 ${response.status}`);
    }
  } catch (error) {
    throw new Error(`本地服务未启动或无法访问。请先在项目目录运行 npm start，再执行 npm run export-review。原始错误：${error.message}`);
  }
}

async function createLoggedContext(browser, username, password, label) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: VIEWPORT
  });

  const loginResponse = await context.request.post(toUrl("/api/auth/login"), {
    data: { username, password }
  });

  if (!loginResponse.ok()) {
    const text = await loginResponse.text().catch(() => "");
    await context.close();
    throw new Error(`登录失败：${label}。${text || `HTTP ${loginResponse.status()}`}`);
  }

  const meResponse = await context.request.get(toUrl("/api/auth/me"));
  if (!meResponse.ok()) {
    await context.close();
    throw new Error(`登录失败：${label} 登录态校验未通过。`);
  }

  return context;
}

async function inspectCanvases(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll("canvas")).map((canvas, index) => {
      const width = canvas.width;
      const height = canvas.height;
      if (!width || !height) {
        return { index, width, height, blank: true, reason: "canvas 无有效尺寸" };
      }

      try {
        const ctx = canvas.getContext("2d");
        if (!ctx) return { index, width, height, blank: true, reason: "无法获取 2D 上下文" };
        const data = ctx.getImageData(0, 0, width, height).data;
        let coloredSamples = 0;
        const step = Math.max(4, Math.floor(data.length / 5000) * 4);
        for (let i = 0; i < data.length; i += step) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          const isVisible = a > 10;
          const isNearWhite = r > 245 && g > 245 && b > 245;
          const isNearTransparent = a < 10;
          if (isVisible && !isNearWhite && !isNearTransparent) coloredSamples += 1;
        }
        return { index, width, height, blank: coloredSamples < 10, coloredSamples };
      } catch (error) {
        return { index, width, height, blank: false, warning: error.message };
      }
    });
  });
}

async function capturePage(context, pageInfo) {
  const page = await context.newPage();
  const screenshotPath = path.join(SCREENSHOT_DIR, `${pageInfo.key}.png`);
  const htmlPath = path.join(HTML_DIR, `${pageInfo.key}.html`);

  try {
    console.log(`正在导出页面：${pageInfo.name}`);
    const response = await page.goto(toUrl(pageInfo.route), {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    if (!response) {
      throw new Error(`页面路由不存在或无响应：${pageInfo.route}`);
    }
    if (response.status() >= 400) {
      throw new Error(`页面路由不存在或返回异常：${pageInfo.route}，HTTP ${response.status()}`);
    }

    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForFunction(() => document.readyState === "complete", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);

    if (pageInfo.requiresLogin && page.url().includes("/login.html")) {
      throw new Error(`登录失败：${pageInfo.name} 被重定向到登录页。`);
    }

    if (typeof pageInfo.action === "function") {
      await pageInfo.action(page);
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(900);
    }

    if (pageInfo.keepScroll) {
      await page.evaluate(() => {});
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    const bodyText = await page.locator("body").innerText({ timeout: 10000 });
    const renderedHtml = await page.evaluate(() => document.documentElement.outerHTML);
    const canvasReport = await inspectCanvases(page);

    writeRenderedPageFile(htmlPath, pageInfo, bodyText, renderedHtml);

    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
      timeout: 30000
    });

    return {
      ...pageInfo,
      route: pageInfo.route,
      screenshotPath,
      htmlPath,
      text: bodyText,
      canvasReport
    };
  } catch (error) {
    if (String(error.message || "").includes("screenshot")) {
      throw new Error(`截图失败：${pageInfo.name}。${error.message}`);
    }
    throw error;
  } finally {
    await page.close().catch(() => {});
  }
}

async function getJson(context, route, errorLabel) {
  const response = await context.request.get(toUrl(route));
  if (!response.ok()) {
    const text = await response.text().catch(() => "");
    throw new Error(`${errorLabel}失败。HTTP ${response.status()} ${text}`);
  }
  return response.json();
}

async function getPatientFollowupRoute(context) {
  const data = await getJson(context, "/api/patients", "读取患者列表");
  const patients = data.patients || [];
  for (const patient of patients) {
    const qr = await getJson(context, `/api/patients/${patient.id}/qrcode`, `读取患者 ${patient.research_id || patient.id} 随访链接`);
    if (!qr.disabled && qr.link) {
      const link = new URL(qr.link, BASE_URL);
      return `${link.pathname}${link.search}`;
    }
  }
  throw new Error("患者 token 不存在：未找到可用的患者随访链接。");
}

function copyDocsSnapshot() {
  DOCS_TO_COPY.forEach((filename) => {
    const source = path.join(ROOT, "docs", filename);
    const target = path.join(DOCS_DIR, filename);
    if (!fs.existsSync(source)) {
      throw new Error(`软著材料缺失：docs/${filename}`);
    }
    fs.copyFileSync(source, target);
  });
}

function copyDeploymentSnapshot() {
  ["DEPLOYMENT.md", ".env.example", "render.yaml", "railway.json", "zeabur.json", "Dockerfile"].forEach((filename) => {
    const source = path.join(ROOT, filename);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(PACKAGE_DIR, filename));
    }
  });
}

function makeUiTextExtract(captures) {
  const sections = captures.map((capture) => {
    return `## ${capture.name}\n\n路由：${capture.route}\n\n\`\`\`text\n${markdownFence(capture.text)}\n\`\`\``;
  });
  fs.writeFileSync(
    path.join(PACKAGE_DIR, "ui_text_extract.md"),
    `# 页面可见文字提取\n\n${sections.join("\n\n")}\n`,
    "utf8"
  );
}

function makePagesManifest(captures) {
  const manifest = captures.map((capture) => ({
    页面名称: capture.name,
    路由: capture.route,
    是否需要登录: capture.requiresLogin,
    使用账号: capture.account || "无需登录",
    截图路径: rel(capture.screenshotPath),
    HTML文本路径: rel(capture.htmlPath),
    页面用途: capture.purpose,
    GPT评审关注点: capture.focus
  }));
  writeJson(path.join(PACKAGE_DIR, "pages_manifest.json"), manifest);
}

function getKeywordContexts(pageTexts, keywords) {
  const findings = [];
  Object.entries(pageTexts).forEach(([pageName, text]) => {
    keywords.forEach((keyword) => {
      let index = String(text).indexOf(keyword);
      while (index !== -1) {
        const start = Math.max(0, index - 42);
        const end = Math.min(String(text).length, index + keyword.length + 42);
        const context = String(text).slice(start, end).replace(/\s+/g, " ").trim();
        if (isAllowedBoundaryContext(keyword, context)) {
          index = String(text).indexOf(keyword, index + keyword.length);
          continue;
        }
        findings.push({
          页面: pageName,
          关键词: keyword,
          上下文: context,
          建议修改方式: suggestReplacement(keyword)
        });
        index = String(text).indexOf(keyword, index + keyword.length);
      }
    });
  });
  return findings;
}

function isAllowedBoundaryContext(keyword, context) {
  if (!MEDICAL_FUNCTION_WORDS.has(keyword)) return false;
  return /(不提供|不自动|不调整|不替代|不接入|不包含|不得作为|不作为|仅用于)/.test(context);
}

function suggestReplacement(keyword) {
  if (["评委", "比赛", "冲奖", "一等奖", "药品赛道", "第9级"].includes(keyword)) {
    return "删除赛事语境，改为中性的系统定位、应用场景或科研数据表达。";
  }
  if (["169例", "98.2%", "98.3%", "疗效显著", "保证有效", "治愈"].includes(keyword)) {
    return "改为真实世界观察性描述，避免绝对化疗效和未注明来源的历史比例。";
  }
  return "页面端避免出现互联网诊疗功能暗示；合规边界建议集中放在 README 或合规说明中。";
}

function makeComplianceCheck(captures) {
  const pageTexts = Object.fromEntries(captures.map((capture) => [capture.name, capture.text]));
  const findings = getKeywordContexts(pageTexts, FORBIDDEN_WORDS);
  let content = "# 合规文案检查\n\n";

  if (!findings.length) {
    content += "未发现明显外露场景、夸大疗效或互联网诊疗相关风险文案。\n";
  } else {
    content += "| 页面 | 关键词 | 上下文 | 建议修改方式 |\n";
    content += "| --- | --- | --- | --- |\n";
    findings.forEach((item) => {
      content += `| ${item.页面} | ${item.关键词} | ${item.上下文.replace(/\|/g, "｜")} | ${item.建议修改方式} |\n`;
    });
  }

  fs.writeFileSync(path.join(PACKAGE_DIR, "compliance_check.md"), content, "utf8");
  return findings;
}

function hasVisiblePhone(text) {
  return /(?<!\d)1[3-9]\d{9}(?!\d)/.test(text);
}

function hasNameInResearchSurface(captures) {
  const researchSurface = new Set(["demo", "research", "export"]);
  const text = captures
    .filter((capture) => researchSurface.has(capture.key))
    .map((capture) => capture.text)
    .join("\n");
  return SIMULATED_NAMES.some((name) => text.includes(name));
}

function hasSimulatedNameInAnyPage(captures) {
  const text = captures.map((capture) => capture.text).join("\n");
  return SIMULATED_NAMES.some((name) => text.includes(name));
}

function buildMetricTrend(trendRows, key) {
  return (trendRows || []).map((item) => ({
    节点: item.label,
    均值: item[key] ?? null
  }));
}

function buildCompletionRates(statsResult) {
  if (Array.isArray(statsResult.completionRates) && statsResult.completionRates.length) {
    return statsResult.completionRates.map((item) => ({
      节点: item.label,
      完成人数: item.completed,
      分母人数: item.total,
      完成率: `${item.rate}%`
    }));
  }

  const stats = statsResult.stats || {};
  return [
    { 节点: "第7天", 完成率: `${stats.day7CompletionRate ?? 0}%` },
    { 节点: "第14天", 完成率: `${stats.day14CompletionRate ?? 0}%` },
    { 节点: "第28天", 完成率: `${stats.day28CompletionRate ?? 0}%` },
    { 节点: "第56天", 完成率: `${stats.day56CompletionRate ?? 0}%` },
    { 节点: "第84天", 完成率: `${stats.day84CompletionRate ?? 0}%` }
  ];
}

function makeDataSummary(statsResult, exportPreview, captures, complianceFindings) {
  const allVisibleText = captures.map((capture) => capture.text).join("\n");
  const allCanvasReports = captures.flatMap((capture) => {
    return (capture.canvasReport || []).map((report) => ({
      页面: capture.name,
      ...report
    }));
  });
  const blankCanvases = allCanvasReports.filter((report) => report.blank === true);
  const exportRows = exportPreview.rows || [];
  const exportFields = exportRows.length ? Object.keys(exportRows[0]) : [];
  const eventExposureWords = new Set(["评委", "比赛", "冲奖", "一等奖", "药品赛道", "第9级", "169例", "98.2%", "98.3%"]);
  const exaggerationWords = new Set(["疗效显著", "保证有效", "治愈"]);
  const medicalFunctionWords = new Set(["自动诊断", "自动开方", "剂量调整", "在线诊疗", "在线问诊", "互联网医院"]);
  const stats = statsResult.stats || {};
  const dataQuality = statsResult.dataQuality || {};

  const summary = {
    总患者数: stats.totalPatients ?? 0,
    基线人数: stats.baselineCount ?? stats.completedBaseline ?? 0,
    各节点完成率: buildCompletionRates(statsResult),
    不良反应患者数: stats.adverseCount ?? 0,
    不良反应发生率: `${stats.adverseReactionRate ?? 0}%`,
    漏服人数: stats.missedDosePatients ?? 0,
    自行停药人数: stats.selfDiscontinuedPatients ?? 0,
    PSQI均值趋势: buildMetricTrend(statsResult.trend, "psqi_simple_score"),
    GAD7均值趋势: buildMetricTrend(statsResult.trend, "gad7_score"),
    PHQ9均值趋势: buildMetricTrend(statsResult.trend, "phq9_score"),
    数据完整率: `${dataQuality.dataCompletenessRate ?? 0}%`,
    导出字段列表: exportFields,
    是否存在未脱敏姓名: hasNameInResearchSurface(captures),
    是否存在页面可见模拟姓名: hasSimulatedNameInAnyPage(captures),
    未脱敏姓名说明: "未脱敏姓名检查范围为数据统计页、展示页和导出页；管理员、医生和患者本人页面可能显示模拟姓名，用于验证业务识别和随访流程。",
    是否存在未脱敏手机号: hasVisiblePhone(allVisibleText),
    是否存在空白图表: blankCanvases.length > 0,
    空白图表明细: blankCanvases,
    是否存在undefined_null_NaN异常显示: /\b(undefined|null|NaN)\b/i.test(allVisibleText),
    是否存在展示场景外露文案: complianceFindings.some((item) => eventExposureWords.has(item.关键词)),
    是否存在夸大疗效文案: complianceFindings.some((item) => exaggerationWords.has(item.关键词)),
    是否存在互联网诊疗功能文案: complianceFindings.some((item) => medicalFunctionWords.has(item.关键词)),
    Canvas检查明细: allCanvasReports
  };

  writeJson(path.join(PACKAGE_DIR, "data_summary.json"), summary);
}

function makeReadme(captures) {
  const pageRows = captures.map((capture) => {
    return `| ${capture.name} | ${capture.route} | ${capture.purpose} |`;
  }).join("\n");

  const content = `# GPT评审导出包说明

## 项目名称

柴牡开郁颗粒真实世界研究与患者随访管理系统

## 系统定位

本系统用于医疗机构制剂柴牡开郁颗粒的真实世界随访、疗效观察、安全性记录和科研数据采集。

## 系统边界

不提供在线诊疗。
不自动诊断。
不自动开方。
不调整用药剂量。
不替代医生诊疗。
正式临床使用前需通过医院伦理和信息安全审批。

## 如何本地运行

\`\`\`bash
npm install
npm run init-db
npm run normalize-demo-data
npm start
\`\`\`

## 默认账号

| 角色 | 用户名 | 密码 |
| --- | --- | --- |
| 管理员 | admin | admin123 |
| 医生 | doctor | doctor123 |

正式部署时应修改默认密码，并设置独立的 SESSION_SECRET。

## 如何重新生成评审包

\`\`\`bash
npm install
npx playwright install chromium
npm run export-review
\`\`\`

生成结果：

- review_package/
- review_package.zip
- review_package/summary_for_competition.md

## 页面用途

| 页面 | 路由 | 用途 |
| --- | --- | --- |
${pageRows}

## GPT评审重点

- 真实世界随访闭环是否完整：建档、二维码或链接、患者填写、医生查看、数据统计、脱敏导出、研究摘要。
- 数据统计页是否以图表和表格为主，是否默认使用 research_id 展示。
- 安全性记录、不良反应、依从性、PSQI、GAD-7、PHQ-9 等数据是否完整。
- 页面文案是否保持中性、专业，是否避免夸大疗效或暗示诊疗服务。
- 软著材料、数据库设计和数据安全说明是否足以支撑申报准备。

## 数据说明

本评审包中的截图和数据均来自系统初始化后的模拟数据，不包含真实患者隐私数据。模拟数据用于功能验证、展示和评审，不代表真实临床结论。

## 隐私和脱敏说明

- 数据统计页默认使用 research_id，不显示姓名和手机号。
- 导出页提供脱敏 CSV 和脱敏 Excel。
- 医生端可查看本人管理患者，手机号以脱敏形式展示。
- 患者随访链接使用随机 token。
- review_package.zip 仅用于系统评审和修改建议收集，不应作为正式临床数据归档文件。
`;

  fs.writeFileSync(path.join(PACKAGE_DIR, "README_REVIEW.md"), content, "utf8");
}

async function saveTransformationSummary(context) {
  const response = await context.request.get(toUrl("/api/research/summary_for_competition.md"));
  if (!response.ok()) {
    const text = await response.text().catch(() => "");
    throw new Error(`成果转化数据摘要导出失败。HTTP ${response.status()} ${text}`);
  }
  fs.writeFileSync(path.join(PACKAGE_DIR, "summary_for_competition.md"), await response.text(), "utf8");
}

function zipPackage() {
  try {
    const zip = new AdmZip();
    zip.addLocalFolder(PACKAGE_DIR, "review_package");
    zip.writeZip(ZIP_PATH);
  } catch (error) {
    throw new Error(`ZIP 打包失败：${error.message}`);
  }
}

function formatFatalError(error) {
  const message = error && error.message ? error.message : String(error);
  if (message.includes("Executable doesn't exist") || message.includes("browserType.launch")) {
    return `Playwright Chromium 未安装或无法启动。请执行 npx playwright install chromium 后重试。原始错误：${message}`;
  }
  return message;
}

async function main() {
  await checkService();
  ensureCleanOutput();
  copyDocsSnapshot();
  copyDeploymentSnapshot();

  let browser;
  let publicContext;
  let adminContext;
  let doctorContext;

  try {
    browser = await chromium.launch();
    publicContext = await browser.newContext({ baseURL: BASE_URL, viewport: VIEWPORT });
    adminContext = await createLoggedContext(browser, "admin", "admin123", "管理员 admin");
    doctorContext = await createLoggedContext(browser, "doctor", "doctor123", "医生 doctor");

    const patientRoute = await getPatientFollowupRoute(adminContext);
    const openFirstDoctorPatient = async (page) => {
      await page.waitForSelector("[data-patient-id]", { timeout: 10000 });
      await page.locator("[data-patient-id]").first().click();
      await page.waitForSelector("#patientDetail", { timeout: 10000 });
      await page.waitForTimeout(1200);
    };
    const pages = [
      ...PAGE_DEFINITIONS,
      {
        key: "doctor_qrcode",
        name: "医生端二维码流程截图",
        route: "/doctor.html",
        requiresLogin: true,
        account: "doctor / doctor123",
        context: "doctor",
        keepScroll: true,
        action: async (page) => {
          await openFirstDoctorPatient(page);
          await page.waitForSelector("#qrHolder img, #qrHolder .empty", { timeout: 10000 });
          await page.locator("#qrHolder").scrollIntoViewIfNeeded();
        },
        purpose: "展示患者建档后生成专属二维码、随访链接、复制、打印和打开患者页能力。",
        focus: "二维码流程是否清晰，患者是否无需手工输入任何信息。"
      },
      {
        key: "doctor_evaluation",
        name: "医生评价截图",
        route: "/doctor.html",
        requiresLogin: true,
        account: "doctor / doctor123",
        context: "doctor",
        keepScroll: true,
        action: async (page) => {
          await openFirstDoctorPatient(page);
          await page.waitForSelector("#evaluationForm", { timeout: 10000 });
          await page.locator("#evaluationForm").scrollIntoViewIfNeeded();
        },
        purpose: "展示医生疗效评价、安全性评价、医生备注、评价时间和评价医生。",
        focus: "医生内部评价是否不暴露给患者端，评价字段是否完整。"
      },
      {
        key: "admin_audit_logs",
        name: "审计日志截图",
        route: "/admin.html",
        requiresLogin: true,
        account: "admin / admin123",
        context: "admin",
        keepScroll: true,
        action: async (page) => {
          await page.waitForSelector("#auditRows tr", { timeout: 10000 }).catch(() => {});
          await page.locator("#auditRows").scrollIntoViewIfNeeded();
        },
        purpose: "展示创建患者、提交随访、医生评价、数据导出、二维码生成等关键操作审计。",
        focus: "审计日志是否覆盖关键数据操作，是否便于管理员追溯。"
      },
      {
        key: "patient_followup",
        name: "患者随访页",
        route: patientRoute,
        requiresLogin: false,
        account: "",
        purpose: "患者扫码进入本人随访页，确认知情同意后填写随访表。",
        focus: "随访表是否完整，是否避免显示真实手机号，是否存在知情同意提示。"
      }
    ];

    const contextMap = {
      public: publicContext,
      admin: adminContext,
      doctor: doctorContext
    };

    const captures = [];
    for (const pageInfo of pages) {
      const context = pageInfo.requiresLogin
        ? contextMap[pageInfo.context || "admin"]
        : publicContext;
      captures.push(await capturePage(context, pageInfo));
    }

    const statsResult = await getJson(adminContext, "/api/research/stats", "读取数据统计数据");
    const exportPreview = await getJson(adminContext, "/api/research/export-preview?deidentified=1", "读取脱敏导出字段");
    const complianceFindings = makeComplianceCheck(captures);

    makeUiTextExtract(captures);
    makePagesManifest(captures);
    makeDataSummary(statsResult, exportPreview, captures, complianceFindings);
    makeReadme(captures);
    await saveTransformationSummary(adminContext);
    zipPackage();

    console.log("已生成 review_package.zip，可上传给 GPT 评审。");
  } finally {
    if (doctorContext) await doctorContext.close().catch(() => {});
    if (adminContext) await adminContext.close().catch(() => {});
    if (publicContext) await publicContext.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`导出失败：${formatFatalError(error)}`);
  process.exitCode = 1;
});
