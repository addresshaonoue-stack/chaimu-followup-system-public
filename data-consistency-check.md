# 数据一致性检查

## 统一演示数据源

| 指标 | 统一口径 |
| --- | --- |
| 建档患者数 | 120 |
| 有效随访记录 | 486 |
| 随访完成率 | 87.5 |
| 数据完整率 | 93.2 |
| 已记录不良事件 | 3 |
| 医生已审核记录 | 428 |

## 数据源校验

| 文件 | 结果 |
| --- | --- |
| data/demo/dashboard-data.json | 通过 |
| public/data/demo/dashboard-data.json | 通过 |

## 旧口径扫描

未发现旧口径残留。

## 说明

运行方式：

```bash
npm run data-consistency-check
```
