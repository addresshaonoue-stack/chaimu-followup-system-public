# 完整源码包运行说明

本目录为完整工程源码包，包含前端页面、Node.js/Express后端、SQLite/PostgreSQL数据层、初始化脚本、演示数据源、PPT大屏页面和评审包导出脚本。

## 本地运行

```bash
npm install
npm run init-db
npm run normalize-demo-data
npm start
```

访问：

- 首页：`http://localhost:3000/`
- 医生工作台：`http://localhost:3000/doctor.html`
- 数据统计：`http://localhost:3000/research.html`
- PPT大屏索引：`http://localhost:3000/ppt-assets.html`

## 98版展示资源

```bash
npm run build-98plus
npm run data-consistency-check
npm run export-review
```

评审展示包生成在 `review_package/` 和 `review_package.zip`。该展示包仅包含静态HTML、截图、演示数据和文档快照，不等同于完整源码包。

## 合规边界

本平台用于院内制剂应用观察、随访数据采集和医生工作辅助，不提供在线诊疗，不生成诊断结论，不自动开方，不自动调整用药剂量，不替代医生线下诊疗。正式临床使用前需通过医院伦理审批、信息安全审批和数据合规审查。

