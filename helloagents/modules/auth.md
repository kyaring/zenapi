# auth 模块

## 职责
- 管理员密码登录与会话签发
- 管理员会话注销与失效处理
- New API 兼容接口鉴权（管理员令牌或会话）

## 接口定义
- `POST /api/auth/login` 管理员登录
- `POST /api/auth/logout` 管理员退出

## 行为规范
- 密码仅来自环境变量 `ADMIN_PASSWORD`
- 会话 token 使用哈希后存储
- 过期会话自动清理
- New API 兼容接口允许使用 `NEW_API_ADMIN_TOKEN` 直接鉴权

## 依赖关系
- `admin_sessions` 表
- `ADMIN_PASSWORD` / `SESSION_TTL_HOURS` / `NEW_API_ADMIN_TOKEN` 环境变量
