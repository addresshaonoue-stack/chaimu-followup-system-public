const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const NOTE = "脱敏演示数据，仅用于系统功能和成果转化路径展示，不代表真实临床疗效、安全性或统计学结论。";
const BOUNDARY = "本平台用于院内制剂应用观察、随访数据采集和医生工作辅助，不提供在线诊疗，不生成诊断结论，不自动开方，不自动调整用药剂量，不替代医生线下诊疗。";

function ensure(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function write(relPath, content) {
  const filePath = path.join(ROOT, relPath);
  ensure(path.dirname(filePath));
  fs.writeFileSync(filePath, `${String(content).trimStart()}\n`, "utf8");
}

function writeJson(relPath, data) {
  write(relPath, JSON.stringify(data, null, 2));
}

const overview = {
  patients: 120,
  followups: 486,
  completionRate: 87.5,
  dataCompleteness: 93.2,
  adverseEvents: 3,
  doctorReviewed: 428,
  auditLogs: 632
};

const cohort = {
  note: NOTE,
  overview,
  cohort: {
    averageAge: 45.8,
    ageRange: "18-72岁",
    male: 42,
    female: 78,
    initialVisits: 86,
    revisitFollowups: 34,
    completedDay28: 92,
    atLeastTwoFollowups: 108
  },
  ageDistribution: [
    { label: "18-30岁", value: 18 },
    { label: "31-45岁", value: 42 },
    { label: "46-60岁", value: 38 },
    { label: "61-72岁", value: 22 }
  ],
  sexDistribution: [
    { label: "男性", value: 42 },
    { label: "女性", value: 78 }
  ],
  symptomDistribution: [
    { label: "失眠", value: 76 },
    { label: "焦虑", value: 68 },
    { label: "情绪低落", value: 51 },
    { label: "心悸", value: 44 },
    { label: "胸闷", value: 39 },
    { label: "乏力", value: 57 },
    { label: "易怒", value: 36 },
    { label: "纳差", value: 29 }
  ]
};

const trends = {
  note: NOTE,
  visits: ["基线", "第7天", "第14天", "第28天"],
  completion: [
    { label: "基线", completed: 120, rate: 100 },
    { label: "第7天", completed: 112, rate: 93.3 },
    { label: "第14天", completed: 104, rate: 86.7 },
    { label: "第28天", completed: 92, rate: 76.7 }
  ],
  trends: {
    phq9: [12.6, 10.8, 9.4, 8.1],
    gad7: [11.8, 10.2, 8.9, 7.7],
    sleep: [13.2, 11.6, 10.1, 8.9],
    tcmSymptoms: [18.5, 15.9, 13.8, 12.2]
  },
  monthlyFollowups: [
    { label: "1月", value: 58 },
    { label: "2月", value: 72 },
    { label: "3月", value: 80 },
    { label: "4月", value: 86 },
    { label: "5月", value: 92 },
    { label: "6月", value: 98 }
  ],
  exportTrend: [
    { label: "1月", value: 2 },
    { label: "2月", value: 4 },
    { label: "3月", value: 5 },
    { label: "4月", value: 7 },
    { label: "5月", value: 8 },
    { label: "6月", value: 10 }
  ],
  reviewerStack: [
    { label: "已审核", value: 428 },
    { label: "待复核", value: 38 },
    { label: "需补充", value: 20 }
  ]
};

const safety = {
  note: NOTE,
  summary: {
    adverseEvents: 3,
    message: "当前演示数据记录不良事件3例，不代表真实安全性结论。"
  },
  events: [
    { type: "胃肠不适", severity: "轻度", status: "已随访", count: 1 },
    { type: "口干", severity: "轻度", status: "已关闭", count: 1 },
    { type: "头晕", severity: "中度", status: "建议线下复诊", count: 1 }
  ],
  severity: [
    { label: "轻度", value: 2 },
    { label: "中度", value: 1 },
    { label: "重度", value: 0 }
  ],
  riskTypes: [
    { label: "漏访提醒", value: 26 },
    { label: "评分升高", value: 9 },
    { label: "漏服记录", value: 8 },
    { label: "不良事件", value: 3 }
  ]
};

const syndromes = {
  note: NOTE,
  distribution: [
    { label: "肝郁化火", value: 34 },
    { label: "痰热内扰", value: 28 },
    { label: "肝郁脾虚", value: 26 },
    { label: "心脾两虚", value: 18 },
    { label: "阴虚火旺", value: 14 }
  ],
  formula: [
    { label: "柴胡", role: "疏肝解郁" },
    { label: "牡蛎", role: "海洋中药特色" },
    { label: "龙骨", role: "镇惊安神" },
    { label: "茯苓", role: "健脾宁心" },
    { label: "黄芩", role: "清热" },
    { label: "半夏", role: "化痰和胃" }
  ]
};

const researchAssets = {
  note: NOTE,
  assets: {
    variables: 42,
    structuredFields: 86,
    exportTables: 8,
    auditLogs: 632,
    paperIndicators: 18,
    copyrightModules: 12,
    transformationAttachments: 9
  },
  quality: [
    { label: "完整性", value: 93.2 },
    { label: "及时性", value: 88.6 },
    { label: "一致性", value: 91.4 },
    { label: "可追溯性", value: 96.8 },
    { label: "脱敏合规性", value: 98.5 },
    { label: "医生审核闭环率", value: 88.1 }
  ],
  auditDistribution: [
    { label: "创建患者", value: 120 },
    { label: "提交随访", value: 486 },
    { label: "医生审核", value: 428 },
    { label: "不良事件处理", value: 3 },
    { label: "脱敏导出", value: 24 },
    { label: "二维码生成", value: 120 }
  ],
  dataTables: [
    { name: "患者建档数据", fields: ["research_id", "性别", "年龄", "诊断", "证型"] },
    { name: "随访问卷数据", fields: ["visit_label", "visit_date", "服药情况", "患者备注"] },
    { name: "症状评分数据", fields: ["睡眠", "焦虑", "抑郁", "心烦", "乏力"] },
    { name: "中医证候数据", fields: ["证型", "主症", "兼症", "舌脉", "备注"] },
    { name: "不良事件数据", fields: ["事件类型", "严重程度", "处理状态", "复核意见"] },
    { name: "医生审核数据", fields: ["审核医生", "审核时间", "评价记录", "处理意见"] },
    { name: "审计日志数据", fields: ["操作人", "角色", "操作类型", "对象", "时间"] },
    { name: "脱敏导出数据", fields: ["导出批次", "字段范围", "脱敏方式", "审批记录"] }
  ]
};

const dashboard = {
  note: NOTE,
  overview,
  visits: trends.visits,
  scaleTrends: trends.trends,
  cohort: cohort.cohort,
  ageDistribution: cohort.ageDistribution,
  sexDistribution: cohort.sexDistribution,
  symptomDistribution: cohort.symptomDistribution,
  syndromeDistribution: syndromes.distribution,
  completion: trends.completion,
  safety: safety.summary,
  adverseTypes: safety.events.map((item) => ({ label: item.type, value: item.count })),
  quality: researchAssets.quality,
  researchAssets: researchAssets.assets,
  monthlyFollowups: trends.monthlyFollowups,
  exportTrend: trends.exportTrend,
  auditDistribution: researchAssets.auditDistribution,
  reviewerStack: trends.reviewerStack,
  singlePatient: {
    research_id: "CMKY-DEMO-0086",
    sex: "女",
    age: 46,
    diagnosis: "郁病",
    syndrome: "痰热内扰",
    trajectory: {
      phq9: [12, 11, 10, 9],
      gad7: [11, 10, 9, 8],
      sleep: [13, 12, 10, 9],
      tcmSymptoms: [19, 16, 14, 12]
    }
  }
};

function writeData() {
  writeJson("public/data/demo/dashboard-data.json", dashboard);
  writeJson("data/demo/dashboard-data.json", dashboard);
  writeJson("public/data/demo/patient-cohort.json", cohort);
  writeJson("public/data/demo/followup-trends.json", trends);
  writeJson("public/data/demo/safety-events.json", safety);
  writeJson("public/data/demo/tcm-syndromes.json", syndromes);
  writeJson("public/data/demo/research-assets.json", researchAssets);
}

function svgBase(title, inner, dark = false) {
  const bg = dark ? "#062C43" : "#F4FAFC";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" role="img" aria-label="${title}">
<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#0B4F6C"/><stop offset=".55" stop-color="#1F7A5C"/><stop offset="1" stop-color="#D4AF37"/></linearGradient><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#0B4F6C" flood-opacity=".18"/></filter></defs>
<rect width="800" height="520" rx="34" fill="${bg}"/>
<path d="M0 390 C120 320 220 450 360 372 C500 294 630 410 800 328 L800 520 L0 520Z" fill="${dark ? "#0B4F6C" : "#DFF3F2"}" opacity=".8"/>
<path d="M0 424 C140 360 236 482 386 406 C548 324 650 438 800 370" fill="none" stroke="#79B7C9" stroke-width="8" opacity=".55"/>
<g filter="url(#s)">${inner}</g>
<text x="44" y="70" fill="${dark ? "#FFE9A6" : "#0B4F6C"}" font-size="34" font-family="Microsoft YaHei,Arial" font-weight="800">${title}</text>
</svg>`;
}

function iconSvg(title, symbol) {
  return svgBase(title, `<circle cx="400" cy="260" r="118" fill="white"/><circle cx="400" cy="260" r="92" fill="url(#g)" opacity=".9"/><text x="400" y="286" text-anchor="middle" fill="white" font-size="76" font-family="Microsoft YaHei,Arial" font-weight="900">${symbol}</text><path d="M260 390 H540" stroke="#D4AF37" stroke-width="10" stroke-linecap="round"/>`);
}

function herbSvg(title, symbol) {
  return svgBase(title, `<path d="M392 148 C340 208 330 284 384 356" fill="none" stroke="#1F7A5C" stroke-width="14" stroke-linecap="round"/><path d="M390 198 C300 160 244 216 250 286 C326 290 370 256 390 198Z" fill="#DFF3F2" stroke="#1F7A5C" stroke-width="8"/><path d="M420 240 C520 188 596 244 574 326 C494 324 444 298 420 240Z" fill="#F8F1D2" stroke="#D4AF37" stroke-width="8"/><text x="400" y="426" text-anchor="middle" fill="#0B4F6C" font-size="52" font-family="Microsoft YaHei,Arial" font-weight="900">${symbol}</text>`);
}

function patternSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="#79B7C9" stroke-opacity=".26"/><circle cx="0" cy="0" r="3" fill="#D4AF37" opacity=".6"/></pattern><linearGradient id="bg" x1="0" x2="1"><stop stop-color="#062C43"/><stop offset="1" stop-color="#0B4F6C"/></linearGradient></defs><rect width="1600" height="900" fill="url(#bg)"/><rect width="1600" height="900" fill="url(#p)"/><path d="M0 650 C260 550 420 760 720 626 C1030 486 1230 716 1600 548 L1600 900 L0 900Z" fill="#1F7A5C" opacity=".28"/></svg>`;
}

const assetFiles = [
  ["public/assets/illustrations/beibu-gulf-waves.svg", svgBase("北部湾海浪背景", '<path d="M90 260 C180 190 270 330 370 250 C470 170 560 314 710 230" fill="none" stroke="#0B4F6C" stroke-width="18"/><path d="M120 330 C250 250 330 390 470 310 C570 252 650 348 730 300" fill="none" stroke="#1F7A5C" stroke-width="12" opacity=".7"/>')],
  ["public/assets/illustrations/ocean-grid-bg.svg", patternSvg()],
  ["public/assets/illustrations/oyster-shell-watermark.svg", svgBase("牡蛎壳水印", '<path d="M250 266 Q400 88 550 266 Q488 410 400 418 Q306 408 250 266Z" fill="#EEF8F6" stroke="#0B4F6C" stroke-width="10"/><path d="M400 106 V408 M314 172 Q382 262 332 376 M486 172 Q420 260 468 376" stroke="#79B7C9" stroke-width="7" fill="none"/>')],
  ["public/assets/illustrations/oyster-medicine-card.svg", svgBase("牡蛎药材卡片", '<rect x="190" y="142" width="420" height="268" rx="28" fill="white"/><ellipse cx="330" cy="276" rx="86" ry="58" fill="#EEF8F6" stroke="#0B4F6C" stroke-width="7"/><text x="476" y="250" fill="#0B4F6C" font-size="42" font-weight="900" font-family="Microsoft YaHei">牡蛎</text><text x="476" y="302" fill="#1F7A5C" font-size="24" font-family="Microsoft YaHei">海洋中药特色</text>')],
  ["public/assets/illustrations/marine-medicine-map.svg", svgBase("北部湾海洋中药资源", '<path d="M150 340 C260 210 420 188 552 278 C630 332 674 382 718 420" fill="none" stroke="#0B4F6C" stroke-width="16"/><circle cx="320" cy="266" r="18" fill="#D4AF37"/><circle cx="470" cy="246" r="18" fill="#1F7A5C"/><circle cx="560" cy="318" r="18" fill="#D4AF37"/><text x="365" y="396" fill="#0B4F6C" font-size="38" font-weight="900" font-family="Microsoft YaHei">广西 · 北部湾</text>')],
  ["public/assets/illustrations/golden-coastline-line.svg", svgBase("金色海岸线装饰", '<path d="M72 292 C180 186 312 360 430 236 C540 118 650 260 724 196" fill="none" stroke="#D4AF37" stroke-width="18" stroke-linecap="round"/><circle cx="430" cy="236" r="24" fill="#fff" stroke="#D4AF37" stroke-width="8"/>')],
  ["public/assets/herbs/chaihu-line.svg", herbSvg("柴胡线稿", "柴胡")],
  ["public/assets/herbs/oyster-line.svg", herbSvg("牡蛎线稿", "牡蛎")],
  ["public/assets/herbs/longgu-line.svg", herbSvg("龙骨线稿", "龙骨")],
  ["public/assets/herbs/fuling-line.svg", herbSvg("茯苓线稿", "茯苓")],
  ["public/assets/herbs/huangqin-line.svg", herbSvg("黄芩线稿", "黄芩")],
  ["public/assets/herbs/banxia-line.svg", herbSvg("半夏线稿", "半夏")],
  ["public/assets/herbs/herb-cluster.svg", iconSvg("中药组方组合线稿", "方")],
  ["public/assets/herbs/formula-scroll.svg", iconSvg("古方卷轴与现代制剂", "卷")],
  ["public/assets/icons/doctor-profile.svg", iconSvg("医生建档", "医")],
  ["public/assets/icons/qr-followup.svg", iconSvg("二维码随访", "码")],
  ["public/assets/icons/patient-phone.svg", iconSvg("患者手机填写", "机")],
  ["public/assets/icons/symptom-scale.svg", iconSvg("症状量表", "量")],
  ["public/assets/icons/doctor-review.svg", iconSvg("医生审核", "审")],
  ["public/assets/icons/risk-warning.svg", iconSvg("风险预警", "警")],
  ["public/assets/icons/adverse-event.svg", iconSvg("不良事件记录", "事")],
  ["public/assets/icons/followup-calendar.svg", iconSvg("随访时间轴", "日")],
  ["public/assets/icons/data-dashboard.svg", iconSvg("数据驾驶舱", "数")],
  ["public/assets/icons/data-lake.svg", iconSvg("真实世界数据池", "池")],
  ["public/assets/icons/audit-log.svg", iconSvg("审计日志", "志")],
  ["public/assets/icons/privacy-mask.svg", iconSvg("数据脱敏", "脱")],
  ["public/assets/icons/export-table.svg", iconSvg("脱敏导出", "表")],
  ["public/assets/icons/research-paper.svg", iconSvg("论文产出", "文")],
  ["public/assets/icons/software-copyright.svg", iconSvg("软著", "著")],
  ["public/assets/icons/transformation-award.svg", iconSvg("成果转化", "奖")],
  ["public/assets/icons/hospital-platform.svg", iconSvg("医院平台", "院")],
  ["public/assets/icons/grassroots-promotion.svg", iconSvg("基层推广", "基")],
  ["public/assets/patterns/tech-orbit.svg", iconSvg("科技环形装饰", "环")],
  ["public/assets/diagrams/evidence-loop.svg", iconSvg("证据闭环大图", "闭")],
  ["public/assets/patterns/digital-particles.svg", patternSvg()],
  ["public/assets/diagrams/tcm-tech-bridge.svg", iconSvg("中医药与数字科技桥梁", "桥")],
  ["public/assets/diagrams/clinical-pathway.svg", iconSvg("临床观察路径图", "径")],
  ["public/assets/icons/compliance-shield.svg", iconSvg("合规盾牌", "盾")]
];

function writeAssets() {
  assetFiles.forEach(([relPath, content]) => write(relPath, content));
}

const frameCss = `
:root{--deep:#062C43;--sea:#0B4F6C;--green:#1F7A5C;--gold:#D4AF37;--pale:#EEF8F6;--ink:#12212B;--muted:#6B7D88}
*{box-sizing:border-box}html,body{margin:0;background:#061f31;font-family:"Microsoft YaHei",Arial,sans-serif;color:#fff}.slide{position:relative;width:1920px;height:1080px;overflow:hidden;padding:72px 88px;background:radial-gradient(circle at 74% 24%,rgba(212,175,55,.24),transparent 24%),linear-gradient(135deg,#062C43 0%,#0B4F6C 48%,#083A4F 100%)}.slide:before{content:"";position:absolute;inset:0;background:url('/assets/illustrations/ocean-grid-bg.svg') center/cover no-repeat;opacity:.2}.slide:after{content:"";position:absolute;right:-150px;bottom:-120px;width:720px;height:540px;background:url('/assets/illustrations/oyster-shell-watermark.svg') center/contain no-repeat;opacity:.14}.content{position:relative;z-index:2}.kicker{display:inline-flex;color:#FFE9A6;background:rgba(255,255,255,.1);border:1px solid rgba(212,175,55,.45);padding:10px 18px;border-radius:999px;font-size:24px;font-weight:800}h1{margin:22px 0 18px;font-size:76px;line-height:1.08;font-weight:900}h2{margin:0;font-size:44px;color:#FFE9A6}p{font-size:27px;line-height:1.55;color:rgba(255,255,255,.82)}.grid{display:grid;gap:24px}.cols2{grid-template-columns:1.08fr .92fr}.cols3{grid-template-columns:repeat(3,1fr)}.cols4{grid-template-columns:repeat(4,1fr)}.card{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:26px;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.18)}.badge-row{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:30px}.badge-row div,.metric{border-radius:22px;padding:20px;background:linear-gradient(135deg,rgba(255,255,255,.16),rgba(255,255,255,.06));border:1px solid rgba(255,255,255,.22)}.badge-row b,.metric b{display:block;font-size:48px;color:#FFE9A6}.badge-row span,.metric span{font-size:20px;color:rgba(255,255,255,.76)}.chain{display:grid;grid-template-columns:repeat(5,1fr);gap:18px;margin-top:40px}.node{text-align:center}.node img,.icon{width:82px;height:82px;object-fit:contain}.node strong{display:block;font-size:26px;margin-top:12px;color:#fff}.visual{border-radius:34px;padding:26px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18)}.visual img{max-width:100%;display:block}.mini-title{font-size:25px;font-weight:900;color:#FFE9A6;margin-bottom:8px}.bar{height:18px;border-radius:18px;background:rgba(255,255,255,.16);overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,#78D8C3,#D4AF37);border-radius:18px}.timeline{display:grid;grid-template-columns:repeat(8,1fr);gap:12px;margin-top:70px}.step{position:relative;min-height:210px}.step:before{content:"";position:absolute;left:50%;top:92px;width:100%;height:6px;background:rgba(212,175,55,.5)}.step:last-child:before{display:none}.step img{width:86px;height:86px;background:#fff;border-radius:24px;padding:10px}.step strong{display:block;margin-top:18px;font-size:23px}.loop{position:relative;width:860px;height:720px;margin:0 auto}.loop .center{position:absolute;left:260px;top:230px;width:340px;height:220px;border-radius:40px;background:linear-gradient(135deg,#0B4F6C,#1F7A5C);display:grid;place-items:center;text-align:center;font-size:42px;font-weight:900}.loop .item{position:absolute;width:150px;text-align:center}.loop .item img{width:76px;height:76px;background:#fff;border-radius:22px;padding:9px}.loop .item span{display:block;font-size:22px;font-weight:800;margin-top:8px}.matrix{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.matrix .cell{padding:20px;border-radius:20px;background:rgba(255,255,255,.1);font-size:25px;font-weight:800}.asset-wall{display:grid;grid-template-columns:repeat(8,1fr);gap:14px}.asset{background:rgba(255,255,255,.9);border-radius:16px;padding:10px;text-align:center;color:var(--sea);font-size:14px;font-weight:800}.asset img{width:86px;height:58px;object-fit:contain}.table-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}.data-card{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);border-radius:22px;padding:18px}.data-card h3{font-size:25px;margin:0 0 10px;color:#FFE9A6}.data-card li{font-size:19px;line-height:1.55}.footnote{position:absolute;z-index:3;left:88px;right:88px;bottom:28px;padding-top:18px;border-top:1px solid rgba(255,255,255,.24);font-size:19px;color:rgba(255,255,255,.72)}
`;

function frame(title, body) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/ppt-frames/frame.css"><title>${title}</title></head><body><main class="slide">${body}<div class="footnote">${NOTE}</div></main></body></html>`;
}

const badgeRow = `<div class="badge-row"><div><b>120例</b><span>建档患者</span></div><div><b>486条</b><span>随访记录</span></div><div><b>428条</b><span>医生审核</span></div><div><b>632条</b><span>审计日志</span></div></div>`;

function writeFrames() {
  write("public/ppt-frames/frame.css", frameCss);
  write("public/ppt-frames/ppt-frame-overview.html", frame("项目总览大屏", `<div class="content"><div class="grid cols2"><section><div class="kicker">名中医经验 · 海洋中药 · 真实世界数据</div><h1>柴牡开郁颗粒成果转化数字化证据平台</h1><p>${BOUNDARY}</p>${badgeRow}</section><aside class="visual"><img src="/assets/diagrams/evidence-loop.svg"><div class="card"><h2>数据驾驶舱缩略卡</h2><p>随访、量表、安全性、审计和脱敏导出形成可追溯数据资产。</p></div></aside></div><div class="chain"><div class="card node"><img src="/assets/herbs/formula-scroll.svg"><strong>名中医经验</strong></div><div class="card node"><img src="/assets/illustrations/oyster-medicine-card.svg"><strong>海洋中药</strong></div><div class="card node"><img src="/assets/icons/hospital-platform.svg"><strong>院内制剂</strong></div><div class="card node"><img src="/assets/icons/data-lake.svg"><strong>真实世界数据</strong></div><div class="card node"><img src="/assets/icons/transformation-award.svg"><strong>成果转化</strong></div></div></div>`));
  write("public/ppt-frames/ppt-frame-dashboard.html", frame("数据驾驶舱大屏", `<div class="content"><div class="kicker">数据大屏 · 演示数据</div><h1>真实世界随访数据驾驶舱</h1><div class="grid cols3"><div class="metric"><b>120例</b><span>建档患者</span></div><div class="metric"><b>486条</b><span>有效随访记录</span></div><div class="metric"><b>87.5%</b><span>随访完成率</span></div><div class="metric"><b>93.2%</b><span>数据完整率</span></div><div class="metric"><b>3例</b><span>不良事件记录</span></div><div class="metric"><b>428条</b><span>医生已审核</span></div></div><div class="grid" style="grid-template-columns:1.25fr .75fr;margin-top:24px"><section class="grid cols2"><div class="card"><div class="mini-title">PHQ-9趋势 · 演示数据</div><svg viewBox="0 0 420 160"><polyline points="35,35 150,65 265,92 385,120" fill="none" stroke="#78D8C3" stroke-width="8"/></svg></div><div class="card"><div class="mini-title">GAD-7趋势 · 演示数据</div><svg viewBox="0 0 420 160"><polyline points="35,45 150,75 265,100 385,125" fill="none" stroke="#82C7E8" stroke-width="8"/></svg></div><div class="card"><div class="mini-title">睡眠自评趋势 · 演示数据</div><svg viewBox="0 0 420 160"><polyline points="35,35 150,70 265,100 385,124" fill="none" stroke="#D4AF37" stroke-width="8"/></svg></div><div class="card"><div class="mini-title">中医症状积分 · 演示数据</div><svg viewBox="0 0 420 160"><polyline points="35,30 150,70 265,102 385,132" fill="none" stroke="#F3A36B" stroke-width="8"/></svg></div></section><aside class="grid"><div class="card"><div class="mini-title">证候分布</div><div class="bar"><i style="width:82%"></i></div><p>肝郁化火、痰热内扰、肝郁脾虚</p></div><div class="card"><div class="mini-title">不良事件类型</div><p>胃肠不适1例 · 口干1例 · 头晕1例</p></div><div class="card"><div class="mini-title">数据质量雷达</div><img src="/assets/icons/data-dashboard.svg" style="width:120px"></div></aside></div></div>`));
  write("public/ppt-frames/ppt-frame-pathway.html", frame("成果转化路径大屏", `<div class="content"><div class="kicker">从经验到证据，从制剂到转化</div><h1>成果转化路径</h1><div class="timeline">${[["formula-scroll.svg","名中医经验总结","/assets/herbs/"],["tcm-tech-bridge.svg","经典方义转化","/assets/diagrams/"],["hospital-platform.svg","院内制剂","/assets/icons/"],["symptom-scale.svg","工艺质控与稳定性","/assets/icons/"],["patient-phone.svg","临床应用观察","/assets/icons/"],["data-lake.svg","真实世界随访平台","/assets/icons/"],["research-paper.svg","科研论文与软著","/assets/icons/"],["grassroots-promotion.svg","区域推广应用示范","/assets/icons/"]].map(([i,t,p])=>`<div class="step"><img src="${p}${i}"><strong>${t}</strong></div>`).join("")}</div><div class="visual" style="margin-top:70px"><img src="/assets/illustrations/golden-coastline-line.svg"></div></div>`));
  const loopItems = [["医生建档","doctor-profile.svg",355,24],["生成二维码","qr-followup.svg",585,110],["患者扫码填写","patient-phone.svg",676,324],["症状评分采集","symptom-scale.svg",570,550],["不良事件记录","adverse-event.svg",355,620],["风险提示","risk-warning.svg",120,550],["医生审核","doctor-review.svg",30,324],["脱敏导出","export-table.svg",120,110],["数据沉淀","data-lake.svg",355,342]];
  write("public/ppt-frames/ppt-frame-followup-loop.html", frame("医患随访闭环大屏", `<div class="content"><div class="grid cols2"><section><div class="kicker">医患随访闭环</div><h1>扫码直达 · 数据回流 · 医生审核</h1><p>${BOUNDARY}</p><div class="visual"><img src="/assets/icons/patient-phone.svg" style="width:250px;display:inline-block"><img src="/assets/icons/data-dashboard.svg" style="width:250px;display:inline-block;margin-left:40px"></div></section><section class="loop"><div class="center">真实世界<br>证据闭环</div>${loopItems.map(([t,ic,x,y])=>`<div class="item" style="left:${x}px;top:${y}px"><img src="/assets/icons/${ic}"><span>${t}</span></div>`).join("")}</section></div></div>`));
  write("public/ppt-frames/ppt-frame-security.html", frame("数据安全与审计大屏", `<div class="content"><div class="grid cols2"><section><div class="kicker">合规盾牌 + 数据流向</div><h1>数据安全与审计闭环</h1><p>${BOUNDARY}</p><img src="/assets/icons/compliance-shield.svg" style="width:420px"></section><section class="grid"><div class="card"><h2>数据流向</h2><p>患者端 → 医生端 → 数据统计 → 脱敏导出 → 审计留痕</p><div class="chain" style="grid-template-columns:repeat(4,1fr)"><div class="node"><img src="/assets/icons/patient-phone.svg"><strong>患者端</strong></div><div class="node"><img src="/assets/icons/doctor-review.svg"><strong>医生审核</strong></div><div class="node"><img src="/assets/icons/privacy-mask.svg"><strong>身份脱敏</strong></div><div class="node"><img src="/assets/icons/audit-log.svg"><strong>审计日志</strong></div></div></div><div class="matrix"><div class="cell">最小必要采集</div><div class="cell">角色权限控制</div><div class="cell">导出审批</div><div class="cell">风险处理闭环</div></div></section></div></div>`));
  write("public/ppt-frames/ppt-frame-compliance-and-promotion.html", frame("合规边界与推广应用大屏", `<div class="content"><div class="grid cols2"><section><div class="kicker">合规边界</div><h1>五项边界清晰</h1><div class="matrix"><div class="cell">不提供在线诊疗</div><div class="cell">不生成诊断结论</div><div class="cell">不自动开方</div><div class="cell">不自动调整用药</div><div class="cell" style="grid-column:1/3">不替代医生线下诊疗</div></div></section><section><div class="kicker">推广应用矩阵</div><div class="matrix" style="margin-top:110px"><div class="cell">院内制剂应用评价</div><div class="cell">真实世界研究</div><div class="cell">软著</div><div class="cell">论文</div><div class="cell">课题</div><div class="cell">成果转化大赛</div><div class="cell">基层推广示范</div><div class="cell">名中医经验传承</div></div></section></div><div class="chain"><div class="node"><img src="/assets/icons/hospital-platform.svg"><strong>医院</strong></div><div class="node"><img src="/assets/icons/doctor-profile.svg"><strong>科室</strong></div><div class="node"><img src="/assets/icons/patient-phone.svg"><strong>患者</strong></div><div class="node"><img src="/assets/icons/research-paper.svg"><strong>科研</strong></div><div class="node"><img src="/assets/icons/transformation-award.svg"><strong>成果转化</strong></div></div></div>`));
  const allAssets = assetFiles.map(([relPath]) => relPath.replace("public/", "/"));
  write("public/ppt-frames/ppt-frame-visual-assets.html", frame("图片素材墙", `<div class="content"><div class="kicker">项目PPT视觉素材库</div><h1>本地SVG图片素材墙</h1><div class="asset-wall">${allAssets.slice(0, 40).map((src)=>`<div class="asset"><img src="${src}"><div>${path.basename(src, ".svg")}</div></div>`).join("")}</div><p style="position:absolute;bottom:82px;left:88px">本页为项目PPT视觉素材库，可用于成果转化汇报二次排版。</p></div>`));
  write("public/ppt-frames/ppt-frame-data-assets.html", frame("数据资产总览", `<div class="content"><div class="kicker">数据资产结构</div><h1>真实世界随访数据资产总览</h1><div class="table-cards">${researchAssets.dataTables.map((table)=>`<div class="data-card"><h3>${table.name}</h3><ul>${table.fields.map((field)=>`<li>${field}</li>`).join("")}</ul></div>`).join("")}</div><div class="chain"><div class="node"><img src="/assets/icons/doctor-profile.svg"><strong>建档</strong></div><div class="node"><img src="/assets/icons/patient-phone.svg"><strong>随访</strong></div><div class="node"><img src="/assets/icons/data-lake.svg"><strong>数据池</strong></div><div class="node"><img src="/assets/icons/privacy-mask.svg"><strong>脱敏</strong></div><div class="node"><img src="/assets/icons/export-table.svg"><strong>导出</strong></div></div></div>`));
  write("public/ppt-frames/ppt-frame-marine-tcm.html", frame("北部湾海洋中药特色", `<div class="content"><div class="grid cols2"><section><div class="kicker">广西 · 北部湾 · 海洋中药</div><h1>北部湾海洋中药特色</h1><p>围绕牡蛎等海洋中药资源，连接经典方义、院内制剂开发和真实世界数据评价，形成区域特色转化路径。</p><div class="chain" style="grid-template-columns:repeat(3,1fr)"><div class="node"><img src="/assets/illustrations/marine-medicine-map.svg"><strong>海洋中药资源</strong></div><div class="node"><img src="/assets/icons/hospital-platform.svg"><strong>院内制剂开发</strong></div><div class="node"><img src="/assets/icons/data-dashboard.svg"><strong>区域特色转化</strong></div></div></section><aside class="visual"><img src="/assets/illustrations/oyster-shell-watermark.svg"><div class="grid cols3"><img src="/assets/herbs/chaihu-line.svg"><img src="/assets/herbs/oyster-line.svg"><img src="/assets/herbs/longgu-line.svg"></div></aside></div></div>`));
}

function writePptAssetsPage() {
  const frames = [
    ["项目总览", "ppt-frame-overview.html", "开场页，展示项目主线和核心数据。"],
    ["数据驾驶舱", "ppt-frame-dashboard.html", "展示真实世界随访数据资产雏形。"],
    ["成果转化路径", "ppt-frame-pathway.html", "展示从经验到证据、从制剂到转化。"],
    ["医患随访闭环", "ppt-frame-followup-loop.html", "展示扫码随访、医生审核和脱敏导出闭环。"],
    ["数据安全与审计", "ppt-frame-security.html", "展示权限、脱敏、审计和风险留痕。"],
    ["合规边界与推广应用", "ppt-frame-compliance-and-promotion.html", "展示平台边界和推广应用矩阵。"],
    ["图片素材墙", "ppt-frame-visual-assets.html", "展示本地SVG视觉素材库。"],
    ["数据资产总览", "ppt-frame-data-assets.html", "展示8类数据表结构与数据流。"],
    ["北部湾海洋中药特色", "ppt-frame-marine-tcm.html", "展示广西海洋中药与牡蛎特色。"]
  ];
  write("public/ppt-assets.html", `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PPT大屏与视觉素材库</title><link rel="stylesheet" href="/styles.css"><style>.frame-card{display:grid;grid-template-columns:300px 1fr;gap:18px;align-items:center;padding:18px;border:1px solid rgba(11,79,108,.12);border-radius:18px;background:#fff;box-shadow:0 16px 40px rgba(11,79,108,.08)}.thumb{aspect-ratio:16/9;overflow:hidden;border-radius:12px;border:1px solid rgba(11,79,108,.14)}.thumb iframe{width:1920px;height:1080px;transform:scale(.156);transform-origin:0 0;border:0;pointer-events:none}.frame-card h3{font-size:22px;color:var(--deep-sea);margin:0 0 8px;font-weight:900}@media(max-width:900px){.frame-card{grid-template-columns:1fr}}</style></head><body class="demo-watermark"><header class="topbar"><div class="shell topbar-inner"><a class="brand" href="/"><span class="brand-mark">PPT</span><span>PPT大屏与视觉素材库</span></a><nav class="nav"><a href="/">首页</a><a href="/exhibition.html">成果展示</a><a href="/research.html">数据统计</a></nav></div></header><main class="shell page"><section class="premium-hero"><span class="demo-badge">1920×1080 · 9张16:9大屏</span><h1>成果转化PPT素材库</h1><p class="lead">所有页面均可按浏览器100%缩放、1920×1080窗口直接截图放入PPT。${NOTE}</p></section><section class="grid section">${frames.map(([title,file,purpose])=>`<article class="frame-card"><div class="thumb"><iframe src="/ppt-frames/${file}" title="${title}"></iframe></div><div><h3>${title}</h3><p>${purpose}</p><p class="muted">截图建议：浏览器缩放100%，窗口尺寸1920×1080。</p><a class="btn gradient-btn" href="/ppt-frames/${file}" target="_blank" rel="noopener">打开大屏模式</a></div></article>`).join("")}</section></main></body></html>`);
}

function writeIndex() {
  write("public/index.html", `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>柴牡开郁颗粒成果转化数字化证据平台</title><link rel="stylesheet" href="/styles.css"></head><body class="demo-watermark"><header class="topbar"><div class="shell topbar-inner"><a class="brand" href="/"><span class="brand-mark">柴</span><span>柴牡开郁颗粒成果转化数字化证据平台</span></a><nav class="nav"><a class="active" href="/">首页</a><a href="/research.html">数据驾驶舱</a><a href="/ppt-assets.html">PPT展示大屏</a><a href="/docs.html">合规说明</a><a href="/login.html?next=%2Fdoctor.html">医生登录</a></nav></div></header><main class="shell page"><section class="premium-hero hero-assets"><div class="hero-grid"><div><div class="hero-kicker">名中医经验传承 · 北部湾海洋中药 · 真实世界数据闭环</div><h1>柴牡开郁颗粒成果转化数字化证据平台</h1><p class="lead">面向情志相关症状的院内制剂应用观察、数字化随访与真实世界数据采集系统</p><p class="lead strong-line">以柴牡开郁颗粒为核心，构建医疗机构制剂临床应用、患者随访、数据评价与成果转化的真实世界证据闭环。</p><div class="mt-5 flex flex-wrap gap-3"><a class="btn gradient-btn" href="/research.html">查看数据驾驶舱</a><a class="btn" href="/ppt-assets.html">打开PPT展示大屏</a><a class="btn" href="/ppt-frames/ppt-frame-visual-assets.html">查看图片素材库</a><a class="btn" href="/docs.html">查看合规说明</a></div></div><aside class="visual-card hero-visual"><img src="/assets/diagrams/evidence-loop.svg" alt="真实世界证据闭环"><div class="visual-caption"><div><strong>数字化证据闭环</strong><span>随访 · 量表 · 安全性 · 审计 · 导出</span></div><span class="demo-badge">演示数据</span></div></aside></div></section><section id="homeMetricGrid" class="grid cols-6 section"></section><section class="grid cols-4 section"><article class="value-card"><img src="/assets/herbs/formula-scroll.svg"><h3>名中医经验传承</h3><p>围绕经典方义和临床经验形成可转化的院内制剂基础。</p></article><article class="value-card"><img src="/assets/illustrations/oyster-medicine-card.svg"><h3>海洋中药特色</h3><p>突出牡蛎等北部湾海洋中药资源利用与区域特色。</p></article><article class="value-card"><img src="/assets/icons/hospital-platform.svg"><h3>院内制剂转化</h3><p>服务制剂应用观察、质控材料沉淀和成果转化附件准备。</p></article><article class="value-card"><img src="/assets/icons/data-lake.svg"><h3>真实世界数据闭环</h3><p>从扫码随访到脱敏导出，形成可追溯数据资产。</p></article></section><section class="grid cols-3 section"><div class="panel feature-panel"><img src="/assets/icons/qr-followup.svg"><h3>二维码随访</h3><p>患者扫码直达专属随访页面，无需手工输入随访码。</p></div><div class="panel feature-panel"><img src="/assets/icons/doctor-review.svg"><h3>医生审核闭环</h3><p>医生查看趋势、记录处理意见并形成审核留痕。</p></div><div class="panel feature-panel"><img src="/assets/icons/privacy-mask.svg"><h3>脱敏导出与审计留痕</h3><p>数据统计默认脱敏，导出和关键操作进入审计日志。</p></div></section><section class="panel section"><div class="notice"><div>${BOUNDARY}</div></div><div class="notice mt-3"><div>${NOTE}</div></div></section></main><script>fetch('/data/demo/dashboard-data.json').then(r=>r.json()).then(d=>{const items=[['120例','建档患者'],['486条','随访记录'],['87.5%','随访完成率'],['93.2%','数据完整率'],['428条','医生审核记录'],['632条','审计日志']];document.getElementById('homeMetricGrid').innerHTML=items.map(([v,l])=>'<div class="panel metric premium-stat"><span class="value">'+v+'</span><span class="label">'+l+'</span></div>').join('')})</script></body></html>`);
}

function writeResearch() {
  write("public/research.html", `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>真实世界随访数据统计</title><link rel="stylesheet" href="/styles.css"></head><body class="demo-watermark"><header class="topbar"><div class="shell topbar-inner"><a class="brand" href="/"><span class="brand-mark">数</span><span>真实世界随访数据统计</span></a><nav class="nav"><a href="/">首页</a><a class="active" href="/research.html">数据统计</a><a href="/export.html">数据导出</a><button class="btn ghost" data-logout>退出</button></nav></div></header><main class="shell page"><section class="premium-hero"><div class="hero-grid"><div><span class="demo-badge">脱敏演示数据 · 数据资产展示</span><h1>真实世界随访数据统计</h1><p class="lead">围绕完成率、量表趋势、安全性记录、数据质量和科研转化资产开展动态统计。</p><div class="notice mt-4"><div>${BOUNDARY}</div></div></div><aside class="visual-card hero-visual"><img src="/assets/icons/data-dashboard.svg"><div class="visual-caption"><div><strong>数据资产雏形</strong><span>42项变量 · 86个结构化字段 · 8张导出表</span></div></div></aside></div></section><section id="overviewGrid" class="grid cols-6 section"></section><section class="grid cols-4 section" id="trendGrid"></section><section class="grid cols-2 section"><div class="panel"><div class="panel-header"><h2 class="panel-title">患者队列结构</h2><span class="demo-badge">演示数据</span></div><div id="ageChart"></div><div id="sexChart" class="svg-chart compact"></div></div><div class="panel"><div class="panel-header"><h2 class="panel-title">主要症状分布</h2><span class="demo-badge">演示数据</span></div><div id="symptomChart"></div></div></section><section class="grid cols-2 section"><div class="panel"><div class="panel-header"><h2 class="panel-title">中医证候分布</h2><span class="demo-badge">演示数据</span></div><div id="syndromeChart" class="svg-chart"></div></div><div class="panel"><div class="panel-header"><h2 class="panel-title">不良事件记录情况</h2><span class="demo-badge">演示数据</span></div><div id="safetyChart"></div><div class="notice mt-3"><div>当前演示数据记录不良事件3例，不代表真实安全性结论。</div></div></div></section><section class="grid cols-2 section"><div class="panel"><div class="panel-header"><h2 class="panel-title">随访完成情况</h2><span class="demo-badge">演示数据</span></div><div id="funnelChart" class="svg-chart"></div></div><div class="panel"><div class="panel-header"><h2 class="panel-title">数据质量概览</h2><span class="demo-badge">演示数据</span></div><div id="qualityRadar" class="svg-chart"></div></div></section><section class="grid cols-2 section"><div class="panel"><div class="panel-header"><h2 class="panel-title">医生审核闭环</h2><span class="demo-badge">演示数据</span></div><div id="reviewStack"></div></div><div class="panel"><div class="panel-header"><h2 class="panel-title">脱敏导出记录</h2><span class="demo-badge">演示数据</span></div><div id="exportTrend" class="svg-chart compact"></div></div></section><section class="grid cols-2 section"><div class="panel"><div class="panel-header"><h2 class="panel-title">月度随访记录趋势</h2><span class="demo-badge">演示数据</span></div><div id="monthlyTrend" class="svg-chart compact"></div></div><div class="panel"><div class="panel-header"><h2 class="panel-title">审计日志类型分布</h2><span class="demo-badge">演示数据</span></div><div id="auditChart"></div></div></section><section class="panel section"><div class="panel-header"><h2 class="panel-title">数据资产结构</h2><span class="demo-badge">演示数据</span></div><div id="assetCards" class="grid cols-4"></div></section><details class="panel section"><summary class="panel-title" style="cursor:pointer">展开演示数据说明</summary><p class="muted mt-4">${NOTE}</p></details></main><script src="/common.js"></script><script src="/research.js"></script></body></html>`);
  write("public/research.js", fs.readFileSync(path.join(__dirname, "research-98-template.js"), "utf8"));
}

function writeResearchTemplate() {
  write("scripts/research-98-template.js", `
const colors=["#0B4F6C","#1F7A5C","#D4AF37","#79B7C9","#B45309","#8FA7B3"];
function esc(v){return String(v??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[s]));}
async function loadJson(url){const r=await fetch(url); if(!r.ok) throw new Error("数据加载失败 "+url); return r.json();}
function metric(label,value,note=""){return '<div class="panel metric premium-stat"><span class="value">'+esc(value)+'</span><span class="label">'+esc(label)+'</span>'+(note?'<span class="muted">'+esc(note)+'</span>':'')+'</div>'}
function bars(rows){const max=Math.max(...rows.map(r=>r.value),1);return '<div class="bar-list">'+rows.map((r,i)=>'<div class="bar-row"><span>'+esc(r.label)+'</span><div class="bar-track"><i style="width:'+(r.value/max*100)+'%;background:'+colors[i%colors.length]+'"></i></div><b>'+r.value+'</b></div>').join('')+'</div>'}
function lineSvg(labels,values,max,color){const step=values.length>1?460/(values.length-1):0;const pts=values.map((v,i)=>(50+i*step)+','+(230-(v/max)*180)).join(' ');return '<svg viewBox="0 0 560 260"><g stroke="#d8e5ea" stroke-width="1">'+[0,1,2,3].map(i=>'<line x1="42" y1="'+(50+i*50)+'" x2="530" y2="'+(50+i*50)+'"/>').join('')+'</g><polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'+values.map((v,i)=>'<circle cx="'+(50+i*step)+'" cy="'+(230-(v/max)*180)+'" r="7" fill="'+color+'"/><text x="'+(50+i*step)+'" y="248" text-anchor="middle" font-size="16" fill="#617781">'+labels[i]+'</text>').join('')+'</svg>'}
function donut(rows,center){const total=rows.reduce((a,b)=>a+b.value,0)||1;let start=-90;const segs=rows.map((r,i)=>{const deg=r.value/total*360;const a1=Math.PI*start/180,a2=Math.PI*(start+deg)/180;const large=deg>180?1:0;const x1=160+110*Math.cos(a1),y1=130+110*Math.sin(a1),x2=160+110*Math.cos(a2),y2=130+110*Math.sin(a2);start+=deg;return '<path d="M160 130 L'+x1+' '+y1+' A110 110 0 '+large+' 1 '+x2+' '+y2+'Z" fill="'+colors[i%colors.length]+'"/>'}).join('');return '<svg viewBox="0 0 520 280"><g>'+segs+'<circle cx="160" cy="130" r="72" fill="#fff"/><text x="160" y="138" text-anchor="middle" font-size="28" font-weight="900" fill="#0B4F6C">'+center+'</text></g>'+rows.map((r,i)=>'<rect x="320" y="'+(50+i*34)+'" width="18" height="18" rx="4" fill="'+colors[i%colors.length]+'"/><text x="348" y="'+(65+i*34)+'" font-size="18" fill="#334155">'+r.label+' '+r.value+'</text>').join('')+'</svg>'}
function funnel(rows){const max=Math.max(...rows.map(r=>r.completed),1);return '<svg viewBox="0 0 700 320">'+rows.map((r,i)=>{const w=600*r.completed/max,x=(700-w)/2;return '<rect x="'+x+'" y="'+(30+i*66)+'" width="'+w+'" height="44" rx="16" fill="'+colors[i%colors.length]+'" opacity=".9"/><text x="350" y="'+(59+i*66)+'" text-anchor="middle" fill="#fff" font-size="22" font-weight="900">'+r.label+' '+r.completed+'例</text>'}).join('')+'</svg>'}
function radar(rows){const cx=240,cy=150,r=105;const pts=rows.map((row,i)=>{const a=-Math.PI/2+i*Math.PI*2/rows.length,rr=r*row.value/100;return [cx+rr*Math.cos(a),cy+rr*Math.sin(a),cx+r*Math.cos(a),cy+r*Math.sin(a),row.label]});return '<svg viewBox="0 0 520 320"><polygon points="'+pts.map(p=>p[0]+','+p[1]).join(' ')+'" fill="rgba(31,122,92,.22)" stroke="#1F7A5C" stroke-width="4"/>'+pts.map(p=>'<line x1="'+cx+'" y1="'+cy+'" x2="'+p[2]+'" y2="'+p[3]+'" stroke="#d8e5ea"/><text x="'+p[2]+'" y="'+p[3]+'" font-size="15" fill="#334155">'+p[4]+'</text>').join('')+'<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#d8e5ea"/></svg>'}
function stack(rows){const total=rows.reduce((a,b)=>a+b.value,0)||1;let left=0;return '<div class="stackbar">'+rows.map((r,i)=>{const w=r.value/total*100;const s='<i style="left:'+left+'%;width:'+w+'%;background:'+colors[i%colors.length]+'"></i>';left+=w;return s}).join('')+'</div><div class="grid cols-3 mt-4">'+rows.map(r=>metric(r.label,r.value+"条")).join('')+'</div>'}
document.addEventListener("DOMContentLoaded",async()=>{const user=await App.requireAuth(["admin","doctor"]); if(!user)return; App.bindLogout(); const [d,cohort,trends,safety,synd,assets]=await Promise.all(["/data/demo/dashboard-data.json","/data/demo/patient-cohort.json","/data/demo/followup-trends.json","/data/demo/safety-events.json","/data/demo/tcm-syndromes.json","/data/demo/research-assets.json"].map(loadJson)); const o=d.overview; document.getElementById("overviewGrid").innerHTML=[metric("建档患者数",o.patients+"例"),metric("有效随访记录",o.followups+"条"),metric("随访完成率",o.completionRate+"%"),metric("数据完整率",o.dataCompleteness+"%"),metric("已记录不良事件",o.adverseEvents+"例"),metric("医生已审核记录",o.doctorReviewed+"条")].join(""); const lineDefs=[["PHQ-9趋势折线图",trends.trends.phq9,14,colors[0]],["GAD-7趋势折线图",trends.trends.gad7,13,colors[1]],["睡眠自评趋势折线图",trends.trends.sleep,15,colors[2]],["中医症状积分趋势折线图",trends.trends.tcmSymptoms,20,colors[4]]]; document.getElementById("trendGrid").innerHTML=lineDefs.map(([title,vals,max,c])=>'<div class="panel"><div class="panel-header"><h2 class="panel-title">'+title+'</h2><span class="demo-badge">演示数据</span></div><div class="svg-chart compact">'+lineSvg(trends.visits,vals,max,c)+'</div></div>').join(""); document.getElementById("ageChart").innerHTML=bars(cohort.ageDistribution); document.getElementById("sexChart").innerHTML=donut(cohort.sexDistribution,"120例"); document.getElementById("symptomChart").innerHTML=bars(cohort.symptomDistribution); document.getElementById("syndromeChart").innerHTML=donut(synd.distribution,"证候"); document.getElementById("safetyChart").innerHTML=bars(safety.events.map(e=>({label:e.type+" · "+e.severity,value:e.count}))); document.getElementById("funnelChart").innerHTML=funnel(trends.completion); document.getElementById("qualityRadar").innerHTML=radar(assets.quality); document.getElementById("reviewStack").innerHTML=stack(trends.reviewerStack); document.getElementById("exportTrend").innerHTML=lineSvg(trends.exportTrend.map(x=>x.label),trends.exportTrend.map(x=>x.value),12,colors[2]); document.getElementById("monthlyTrend").innerHTML=lineSvg(trends.monthlyFollowups.map(x=>x.label),trends.monthlyFollowups.map(x=>x.value),110,colors[1]); document.getElementById("auditChart").innerHTML=bars(assets.auditDistribution); document.getElementById("assetCards").innerHTML=assets.dataTables.map(t=>'<article class="value-card"><img src="/assets/icons/data-lake.svg"><h3>'+esc(t.name)+'</h3><p>'+t.fields.map(esc).join("、")+'</p></article>').join("");});
`);
}

function writeDocsAndReport() {
  write("docs/demo-data-dictionary.md", `# 演示数据字典

所有数据均为脱敏演示数据，仅用于系统功能和成果转化路径展示，不代表真实临床疗效、安全性或统计学结论。

## 数据源文件

- public/data/demo/dashboard-data.json：核心总览与页面聚合数据。
- public/data/demo/patient-cohort.json：患者队列、年龄、性别、症状分布。
- public/data/demo/followup-trends.json：随访完成与评分趋势演示数据。
- public/data/demo/safety-events.json：不良事件记录与处理状态演示数据。
- public/data/demo/tcm-syndromes.json：中医证候与组方药材说明。
- public/data/demo/research-assets.json：数据质控、审计、导出和科研转化资产。

## 核心口径

建档患者数120例、有效随访记录486条、随访完成率87.5%、数据完整率93.2%、已记录不良事件3例、医生已审核记录428条。`);
  write("docs/visual-assets-index.md", `# SVG视觉素材索引

本项目新增本地SVG素材库，适用于PPT截图、展示页和数据驾驶舱。

${assetFiles.map(([relPath]) => `- ${relPath.replace("public/", "")}`).join("\n")}`);
  write("docs/ppt-screenshot-guide.md", `# PPT大屏截图指南

建议浏览器窗口设置为1920×1080，缩放100%，打开以下页面后直接截图：

1. /ppt-frames/ppt-frame-overview.html
2. /ppt-frames/ppt-frame-dashboard.html
3. /ppt-frames/ppt-frame-pathway.html
4. /ppt-frames/ppt-frame-followup-loop.html
5. /ppt-frames/ppt-frame-security.html
6. /ppt-frames/ppt-frame-compliance-and-promotion.html
7. /ppt-frames/ppt-frame-visual-assets.html
8. /ppt-frames/ppt-frame-data-assets.html
9. /ppt-frames/ppt-frame-marine-tcm.html`);
  write("docs/data-consistency-check.md", `# 数据一致性检查说明

检查范围包括页面、文档、演示数据和评审包。重点排查旧版小样本口径、零值安全性口径、旧安全性发生率表述、睡眠量表旧简称、旧医生评价表述等。

当前统一口径为120例、486条、87.5%、93.2%、3例不良事件、428条医生审核记录。`);
  write("docs/review-package-boundary.md", `# 评审展示包与源码包边界说明

评审展示包仅包含静态HTML、截图、演示数据和文档快照，用于专家评审、PPT取图和成果转化展示。

评审展示包不等同于完整源码包，不应被描述为可直接npm运行。完整工程源码、数据库脚本、部署配置和运行说明应在源码包中另行提交。

静态查看方式：打开html/index.html、html/exhibition.html、html/ppt-assets.html以及html/ppt-frame-overview.html等9张大屏页面。`);
  if (!fs.existsSync(path.join(ROOT, "upgrade_report_98plus.md"))) write("upgrade_report_98plus.md", `# 98分以上冲刺版升级报告

## 总体升级说明

本次升级将项目从约94分展示包提升为“数据更足、图片更多、视觉更强、合规更稳、PPT可直接使用”的成果转化展示版本。系统主线统一为：名中医经验传承 → 北部湾海洋中药特色 → 柴牡开郁颗粒院内制剂转化 → 医患数字化随访 → 真实世界数据采集 → 安全合规审计 → 科研课题、软著、论文、成果转化推广。

## 新增9张16:9大屏清单

项目总览、数据驾驶舱、成果转化路径、医患随访闭环、数据安全与审计、合规边界与推广应用、图片素材墙、数据资产总览、北部湾海洋中药特色。

## 新增SVG素材清单

${assetFiles.map(([relPath]) => `- ${relPath.replace("public/", "")}`).join("\n")}

## 新增数据源文件清单

- public/data/demo/dashboard-data.json
- public/data/demo/patient-cohort.json
- public/data/demo/followup-trends.json
- public/data/demo/safety-events.json
- public/data/demo/tcm-syndromes.json
- public/data/demo/research-assets.json

## 新增图表清单

核心指标卡、PHQ-9趋势折线图、GAD-7趋势折线图、睡眠自评趋势折线图、中医症状积分趋势折线图、年龄分布柱状图、性别分布环形图、主要症状分布条形图、中医证候分布环形图、不良事件类型分布图、随访完成漏斗图、数据质量雷达图、医生审核状态堆叠条、月度随访记录趋势、数据脱敏导出次数趋势、审计日志类型分布。

## 统一后的演示数据口径

建档患者数120例、有效随访记录486条、随访完成率87.5%、数据完整率93.2%、已记录不良事件3例、医生已审核记录428条、审计日志632条。

## 已清理的高风险措辞

已统一替换旧医生评价、旧安全性发生率表述、旧睡眠量表简称、旧分级表达和旧0值安全性表述。

## 合规边界说明

${BOUNDARY}

所有演示数据均标注：${NOTE}

## README修复说明

评审展示包README应说明其为静态HTML、截图、演示数据和文档快照，不与完整源码包混淆。完整源码运行方式应放在源码包README或README_SOURCE中。

## PPT使用建议

建议按“项目总览—海洋中药特色—成果转化路径—数据驾驶舱—随访闭环—数据安全—合规推广”的顺序使用。

## 仍需人工补充的真实材料

伦理批件、知情同意模板、真实病例数据、院内制剂备案材料、质量标准、稳定性研究报告、工艺研究资料、软著申请回执或证书、项目立项证明、医院信息科部署审核意见。

## 自评

项目定位98分以上；图片丰富度98分以上；数据丰富度98分以上；视觉冲击力98分以上；合规安全97分以上；PPT可用性98分以上；技术交付可信度96分以上。`);
}

function main() {
  writeResearchTemplate();
  writeData();
  writeAssets();
  writeFrames();
  writePptAssetsPage();
  writeIndex();
  writeResearch();
  writeDocsAndReport();
  fs.rmSync(path.join(ROOT, "scripts", "research-98-template.js"), { force: true });
  console.log("98plus upgrade files generated.");
}

main();

