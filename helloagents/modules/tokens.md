# tokens 模块

## 职责
- 管理 API 令牌的生成与生命周期
- 维护额度与已用额度统计
- 控制令牌启用/禁用状态

## 接口定义
- `GET /api/tokens` 令牌列表
- `POST /api/tokens` 生成令牌
- `PATCH /api/tokens/:id` 更新令牌
- `DELETE /api/tokens/:id` 删除令牌
- `GET /api/tokens/:id/reveal` 再次查看令牌

## 行为规范
- 令牌可通过 reveal 接口再次查看
- 默认允许所有渠道
- 额度消耗由代理调用记录

## 依赖关系
- `tokens` 表
- `usage` 模块（用量回写）
