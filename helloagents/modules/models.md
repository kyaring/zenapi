# models 模块

## 职责
- 汇总各渠道模型列表
- 输出模型与渠道的映射关系

## 接口定义
- `GET /api/models` 模型广场列表
- `GET /api/user/models` New API 兼容用户模型列表

## 行为规范
- 仅聚合启用状态的渠道
- 优先使用渠道连通性测试返回的模型数据

## 依赖关系
- `channels` 表
