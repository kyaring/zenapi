# admin-ui 模块

## 职责
- 管理台前端展示与操作
- 覆盖渠道、模型、令牌、日志、面板与设置

## 接口定义
- 调用 `/api/*` 管理接口
- 登录后使用 Bearer token

## 行为规范
- Vite 构建静态文件
- 前端状态集中在单页
- Token 仅本地保存，不回显

## 依赖关系
- `auth` / `channels` / `models` / `tokens` / `usage` / `dashboard` / `settings` 模块
