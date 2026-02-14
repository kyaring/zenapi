# dashboard 模块

## 职责
- 汇总调用统计指标
- 输出按时间、模型、渠道、令牌的聚合数据

## 接口定义
- `GET /api/dashboard` 数据面板汇总

## 行为规范
- 以 `usage_logs` 为统计来源
- 默认返回最近 30 条趋势数据

## 依赖关系
- `usage_logs` 表
- `tokens` / `channels` 表
