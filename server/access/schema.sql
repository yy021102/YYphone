PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS codes (hash TEXT PRIMARY KEY, created_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, salt TEXT NOT NULL, code_hash TEXT NOT NULL UNIQUE REFERENCES codes(hash), disabled INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS devices (user_id TEXT NOT NULL REFERENCES users(id), fingerprint TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,fingerprint));
CREATE TRIGGER IF NOT EXISTS limit_devices BEFORE INSERT ON devices
WHEN NOT EXISTS (SELECT 1 FROM devices WHERE user_id=NEW.user_id AND fingerprint=NEW.fingerprint)
AND (SELECT COUNT(*) FROM devices WHERE user_id=NEW.user_id)>=2
BEGIN SELECT RAISE(ABORT,'DEVICE_LIMIT'); END;
CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, fingerprint TEXT NOT NULL, expires INTEGER NOT NULL, FOREIGN KEY(user_id,fingerprint) REFERENCES devices(user_id,fingerprint) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS code_batches (id TEXT PRIMARY KEY, label TEXT NOT NULL, count INTEGER NOT NULL, created_at INTEGER NOT NULL, sealed TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS batch_codes (hash TEXT PRIMARY KEY REFERENCES codes(hash), batch_id TEXT NOT NULL REFERENCES code_batches(id));
CREATE INDEX IF NOT EXISTS batch_codes_batch ON batch_codes(batch_id);
CREATE TABLE IF NOT EXISTS code_secrets (hash TEXT PRIMARY KEY REFERENCES codes(hash), sealed TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS user_metadata (user_id TEXT PRIMARY KEY REFERENCES users(id), registered_at INTEGER, last_login INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS device_info (user_id TEXT NOT NULL, fingerprint TEXT NOT NULL, label TEXT NOT NULL, last_login INTEGER NOT NULL, PRIMARY KEY(user_id,fingerprint), FOREIGN KEY(user_id,fingerprint) REFERENCES devices(user_id,fingerprint) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS discord_accounts (user_id TEXT PRIMARY KEY REFERENCES users(id), discord_id TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, guild_id TEXT NOT NULL, sealed_token TEXT NOT NULL, token_expires INTEGER NOT NULL, checked_at INTEGER NOT NULL, member INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS oauth_states (hash TEXT PRIMARY KEY, browser_hash TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS client_oauth_tickets (hash TEXT PRIMARY KEY, sealed_device TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS client_exchanges (hash TEXT PRIMARY KEY, device_hash TEXT NOT NULL, sealed_session TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS admin_sessions (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS admin_bootstrap (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS oauth_client_flows (state_hash TEXT PRIMARY KEY, sealed_device TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS oauth_return_targets (state_hash TEXT PRIMARY KEY, return_url TEXT NOT NULL, expires INTEGER NOT NULL);
