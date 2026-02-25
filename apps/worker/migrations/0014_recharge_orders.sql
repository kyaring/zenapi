CREATE TABLE IF NOT EXISTS recharge_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  out_trade_no TEXT NOT NULL UNIQUE,
  trade_no TEXT,
  ldc_amount REAL NOT NULL,
  balance_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS recharge_orders_user ON recharge_orders(user_id);
CREATE INDEX IF NOT EXISTS recharge_orders_trade ON recharge_orders(out_trade_no);
