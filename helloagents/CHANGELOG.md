# 变更日志

## [Unreleased]

### 微调
- **[admin-ui]**: 本地开发增加 Vite proxy 解决前后端端口不一致
  - 类型: 微调（无方案包）
  - 文件: apps/admin/vite.config.ts, README.md
- **[worker]**: 补充 wrangler.toml 示例配置占位
  - 类型: 微调（无方案包）
  - 文件: apps/worker/wrangler.toml
- **[admin-ui]**: 渠道 ID 与日志渠道可见，操作反馈更清晰
  - 类型: 微调（无方案包）
  - 文件: apps/admin/src/main.ts
- **[worker]**: 使用日志关联渠道/令牌，base_url 自动纠正
  - 类型: 微调（无方案包）
  - 文件: apps/worker/src/routes/usage.ts, apps/worker/src/routes/channels.ts, apps/worker/src/routes/proxy.ts
- **[worker]**: 渠道 ID 支持自定义，令牌可二次查看
  - 类型: 微调（无方案包）
  - 文件: apps/worker/src/routes/channels.ts, apps/worker/src/routes/tokens.ts, apps/worker/src/db/schema.sql, apps/worker/migrations/0002_add_token_plain.sql
- **[admin-ui]**: 渠道 ID 可录入、令牌查看按钮
  - 类型: 微调（无方案包）
  - 文件: apps/admin/src/main.ts
- **[tests]**: 补充 URL 规范化单测
  - 类型: 微调（无方案包）
  - 文件: tests/worker/url.test.ts
- **[proxy]**: 增加失败轮询重试与相关配置
  - 类型: 微调（无方案包）
  - 文件: apps/worker/src/routes/proxy.ts, apps/worker/src/env.ts, apps/worker/wrangler.toml
- **[docs]**: 更新代理重试与本地配置说明
  - 类型: 微调（无方案包）
  - 文件: README.md, helloagents/modules/proxy.md
- **[worker]**: 放宽路由严格匹配以兼容 `/api/channel/` 尾斜杠
  - 类型: 微调（无方案包）
  - 文件: apps/worker/src/index.ts
- **[worker]**: 新增 `/api/group` 兼容接口并放行鉴权
  - 类型: 微调（无方案包）
  - 文件: apps/worker/src/index.ts, apps/worker/src/routes/newapiGroups.ts, tests/worker/newapi.test.ts

## [0.2.1] - 2026-02-15

### 变更
- **[tooling]**: 切换为 Bun 作为包管理器，补充部署说明与 fix 命令
  - 方案: [202602150153_bun-tooling](archive/2026-02/202602150153_bun-tooling/)

## [0.2.0] - 2026-02-15

### 新增
- **[channels/auth/models]**: 新增 New API 兼容渠道管理接口、用户模型接口与管理员令牌鉴权
  - 方案: [202602150127_newapi-channel-compat](archive/2026-02/202602150127_newapi-channel-compat/)
  - 决策: newapi-channel-compat#D001(新增兼容层并保留扩展字段)

## [0.1.0] - 2026-02-14

### 新增
- **[核心服务]**: 初始化 Worker + D1 后端与 Vite 管理台，提供渠道/模型/令牌/日志/面板与 OpenAI 兼容代理
  - 方案: [202602142217_new-api-lite](archive/2026-02/202602142217_new-api-lite/)
  - 决策: new-api-lite#D001(单 Worker + Hono), new-api-lite#D002(Vite + Pages), new-api-lite#D003(Token 默认全渠道), new-api-lite#D004(日志保留可配置)

### 修复
- **[{模块名}]**: {修复描述}
  - 方案: [{YYYYMMDDHHMM}_{fix}](archive/{YYYY-MM}/{YYYYMMDDHHMM}_{fix}/)

### 微调
- **[{模块名}]**: {微调描述}
  - 类型: 微调（无方案包）
  - 文件: {文件路径}:{行号范围}

### 回滚
- **[{模块名}]**: 回滚至 {版本/提交}
  - 原因: {回滚原因}
  - 方案: [{原方案包}](archive/{YYYY-MM}/{原方案包}/)
