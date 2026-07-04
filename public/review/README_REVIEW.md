# GPT评审导出包说明

## 项目名称

柴牡开郁颗粒真实世界研究与患者随访管理系统

## 系统定位

本包为评审展示导出包，仅包含静态HTML、截图、演示数据、SVG视觉素材和文档快照，用于专家评审、PPT取图和成果转化展示。完整工程源码、数据库脚本和部署配置应在源码包中另行提交。

本系统用于医疗机构制剂柴牡开郁颗粒的真实世界随访、应用观察、安全性记录和科研数据采集。

## 系统边界

不提供在线诊疗。
不生成诊断结论。
不自动开方。
不调整用药剂量。
不替代医生诊疗。
正式临床使用前需通过医院伦理和信息安全审批。

## 静态查看方式

本评审包不是完整源码包，不应作为可直接 npm 运行的工程包使用。建议按以下方式查看：

- 打开 html/index.html 查看首页。
- 打开 html/exhibition.html 查看成果展示总览。
- 打开 html/ppt-assets.html 查看PPT大屏索引。
- 打开 html/ppt-frame-overview.html、html/ppt-frame-dashboard.html、html/ppt-frame-pathway.html 等9张16:9大屏页面。
- 打开 screenshots/ 文件夹直接查看页面截图。
- 打开 assets/ 文件夹查看可复用SVG素材。
- 打开 data/demo/ 文件夹查看结构化演示数据JSON。

完整工程源码、数据库脚本和部署配置应在源码包中另行提交。

## 包内关键文件

- README_REVIEW.md
- pages_manifest.json
- data_summary.json
- compliance_check.md
- summary_for_competition.md
- upgrade_report_98plus_final.md
- data-consistency-check.md

## 页面用途

| 页面 | 路由 | 用途 |
| --- | --- | --- |
| 首页 | / | 展示系统定位、入口和真实世界随访闭环。 |
| 展示页 | /demo.html | 以图表化方式呈现数据闭环、核心指标和脱敏导出能力。 |
| 成果转化展示页 | /exhibition.html | 用于展示成果转化路径、真实世界证据闭环、核心演示指标和数据质控视图。 |
| PPT素材导出页 | /ppt-assets.html | 提供项目总览、证据闭环、成果转化路线图、二维码流程和脱敏流程等可截图素材。 |
| 16:9项目总览大屏 | /ppt-frames/ppt-frame-overview.html | 展示项目定位、名中医经验、海洋中药特色、院内制剂转化和真实世界数据闭环。 |
| 16:9数据驾驶舱大屏 | /ppt-frames/ppt-frame-dashboard.html | 展示120例、486条、87.5%、93.2%、3例不良事件和428条医生审核记录。 |
| 16:9成果转化路径大屏 | /ppt-frames/ppt-frame-pathway.html | 展示经验总结、院内制剂、数字化随访和成果转化推广路径。 |
| 16:9医患随访闭环大屏 | /ppt-frames/ppt-frame-followup-loop.html | 展示医生建档、二维码、患者填写、趋势形成、审核和脱敏导出流程。 |
| 16:9数据安全审计大屏 | /ppt-frames/ppt-frame-security.html | 展示最小必要采集、脱敏、权限、导出审批、审计日志和风险留痕。 |
| 16:9合规推广大屏 | /ppt-frames/ppt-frame-compliance-and-promotion.html | 展示合规边界与后续推广应用方向。 |
| 16:9图片素材墙大屏 | /ppt-frames/ppt-frame-visual-assets.html | 展示本地SVG视觉素材库，便于PPT二次排版取图。 |
| 16:9数据资产总览大屏 | /ppt-frames/ppt-frame-data-assets.html | 展示患者建档、随访、症状、证候、安全性、审核、审计和脱敏导出等数据资产结构。 |
| 16:9北部湾海洋中药特色大屏 | /ppt-frames/ppt-frame-marine-tcm.html | 展示广西北部湾、牡蛎、海洋中药资源与院内制剂转化特色。 |
| 文档说明页 | /docs.html | 说明软著、研究方案、数据安全和风险预警相关材料。 |
| 三位一体成果闭环截图 | /demo.html | 展示医疗机构制剂、海洋中药牡蛎和真实世界随访系统的成果闭环。 |
| 完整静态系统页 | /standalone-demo.html#home | 展示单文件 HTML 版本，保留管理员、医生、患者随访、数据统计、导出和审计日志等主要功能。 |
| 完整静态数据统计页 | /standalone-demo.html#stats | 展示完整静态版的数据统计、图表驾驶舱、单患者轨迹和脱敏导出入口。 |
| 登录页 | /login.html | 提供管理员和医生账号登录入口。 |
| 管理员后台 | /admin.html | 管理医生账号、患者总览、审计日志和系统统计。 |
| 医生工作台 | /doctor.html | 创建患者、查看本人管理患者、查看趋势、风险预警和医生评价。 |
| 医生端快捷入口截图 | /doctor.html | 展示本次应随访、逾期随访和需关注患者快捷筛选入口。 |
| 数据统计页 | /research.html | 图表化展示随访完成率、量表趋势、安全性记录和数据质量。 |
| 数据导出页 | /export.html | 导出脱敏 CSV、脱敏 Excel 和数据统计数据。 |
| 医生端二维码流程截图 | /doctor.html | 展示患者建档后生成专属二维码、随访链接、复制、打印和打开患者页能力。 |
| 医生评价截图 | /doctor.html | 展示医生综合观察评价、安全性评价、医生备注、评价时间和评价医生。 |
| 审计日志截图 | /admin.html | 展示创建患者、提交随访、医生评价、数据导出、二维码生成等关键操作审计。 |
| 患者随访页 | /patient.html?token=9205ee6e780f3aa3f652d6fd6e3ca6d12efda62c98e51f43 | 患者扫码进入本人随访页，确认知情同意后填写随访表。 |

## GPT评审重点

- 真实世界随访闭环是否完整：建档、二维码或链接、患者填写、医生查看、数据统计、脱敏导出、研究摘要。
- 数据统计页是否以图表和表格为主，是否默认使用 research_id 展示。
- 不良事件记录、依从性、睡眠自评、GAD-7、PHQ-9 等数据是否完整。
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
