ALTER TABLE chapters ADD COLUMN content_updated_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE chapters ADD COLUMN title_updated_at INTEGER NOT NULL DEFAULT 0;

UPDATE chapters
SET content_updated_at = updated_at,
    title_updated_at = updated_at
WHERE content_updated_at = 0 OR title_updated_at = 0;

CREATE TABLE IF NOT EXISTS chapter_edit_locks (
  chapter_id TEXT PRIMARY KEY NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_label TEXT NOT NULL,
  lock_token TEXT NOT NULL,
  lock_version TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  heartbeat_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS chapter_edit_locks_user_id_idx ON chapter_edit_locks(user_id);
CREATE INDEX IF NOT EXISTS chapter_edit_locks_expires_at_idx ON chapter_edit_locks(expires_at);
