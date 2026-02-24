ALTER TABLE users ADD COLUMN withdrawable_balance REAL NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS withdrawal_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  out_trade_no TEXT NOT NULL UNIQUE,
  balance_amount REAL NOT NULL,
  ldc_amount REAL NOT NULL,
  fee_amount REAL NOT NULL DEFAULT 0,
  fee_rate REAL NOT NULL DEFAULT 0,
  linuxdo_id TEXT NOT NULL,
  linuxdo_username TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS withdrawal_orders_user ON withdrawal_orders(user_id);
CREATE INDEX IF NOT EXISTS withdrawal_orders_trade ON withdrawal_orders(out_trade_no);
