export type Bindings = {
  DB: D1Database;
  ADMIN_PASSWORD: string;
  SESSION_TTL_HOURS?: string;
  LOG_RETENTION_DAYS?: string;
  CORS_ORIGIN?: string;
  PROXY_RETRY_ROUNDS?: string;
  PROXY_RETRY_DELAY_MS?: string;
  NEW_API_ADMIN_TOKEN?: string;
  NEWAPI_ADMIN_TOKEN?: string;
};

export type AppEnv = {
  Bindings: Bindings;
};
