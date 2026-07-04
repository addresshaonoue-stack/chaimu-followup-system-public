const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const demoPath = path.join(ROOT, "data", "demo", "dashboard-data.json");
const publicDemoPath = path.join(ROOT, "public", "data", "demo", "dashboard-data.json");
const reportPath = path.join(ROOT, "data-consistency-check.md");

const demo = JSON.parse(fs.readFileSync(demoPath, "utf8"));
const publicDemo = JSON.parse(fs.readFileSync(publicDemoPath, "utf8"));
const expected = {
  建档患者数: 120,
  有效随访记录: 486,
  随访完成率: 87.5,
  数据完整率: 93.2,
  已记录不良事件: 3,
  医生已审核记录: 428
};

const legacyPatterns = [
  /(?<!\d)20例/g,
  /总患者数[：:\s]*20例/g,
  /20 个模拟患者/g,
  /(?<![\d.])85%(?!\d)/g,
  /(?<![\d.])0%不良/g,
  /综合随访完成率[：:\s]*85%/g,
  /不良反应发生率[：:\s]*0%/g,
  /数据完整率[：:\s]*94%/g,
  /不良反应患者数为 0/g,
  /当前模拟随访数据未记录不良反应/g,
  /疗效评价/g,
  /疗效观察/g,
  /显效/g,
  /无效/g,
  /PSQI简表/g,
  /PSQI简化/g,
  /自动分级/g,
  /疗效显著/g,
  /安全性确切/g
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "review_package"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(html|js|md|svg|json)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const SCAN_ROOTS = [
  path.join(ROOT, "public"),
  path.join(ROOT, "docs"),
  path.join(ROOT, "data", "demo"),
  path.join(ROOT, "README.md")
];

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

const sourceChecks = [
  ["data/demo/dashboard-data.json", demo.overview],
  ["public/data/demo/dashboard-data.json", publicDemo.overview]
].map(([source, overview]) => ({
  source,
  ok: overview.patients === expected.建档患者数
    && overview.followups === expected.有效随访记录
    && overview.completionRate === expected.随访完成率
    && overview.dataCompleteness === expected.数据完整率
    && overview.adverseEvents === expected.已记录不良事件
    && overview.doctorReviewed === expected.医生已审核记录
}));

const findings = [];
const filesToScan = SCAN_ROOTS.flatMap((target) => {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isDirectory()) return walk(target);
  return [target];
});

for (const file of filesToScan) {
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of legacyPatterns) {
    const matches = text.match(pattern);
    if (matches) findings.push({ file: rel(file), pattern: String(pattern), count: matches.length });
  }
}

const report = `# 数据一致性检查

## 统一演示数据源

| 指标 | 统一口径 |
| --- | --- |
${Object.entries(expected).map(([key, value]) => `| ${key} | ${value} |`).join("\n")}

## 数据源校验

| 文件 | 结果 |
| --- | --- |
${sourceChecks.map((item) => `| ${item.source} | ${item.ok ? "通过" : "不一致"} |`).join("\n")}

## 旧口径扫描

${findings.length ? findings.map((item) => `- ${item.file}：${item.pattern}，${item.count}处`).join("\n") : "未发现旧口径残留。"}

## 说明

运行方式：

\`\`\`bash
npm run data-consistency-check
\`\`\`
`;

fs.writeFileSync(reportPath, report, "utf8");
console.log(report);
if (!sourceChecks.every((item) => item.ok) || findings.length) process.exitCode = 1;
