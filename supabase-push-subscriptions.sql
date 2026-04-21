-- ============================================
-- Web Push Subscriptions — run once in Supabase SQL editor
-- ============================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_name TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_name);
