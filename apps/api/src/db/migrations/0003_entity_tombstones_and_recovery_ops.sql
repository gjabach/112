CREATE TABLE IF NOT EXISTS entity_tombstones (
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  project_id TEXT,
  deleted_at INTEGER NOT NULL,
  delete_operation_id TEXT,
  deleted_revision INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS entity_tombstones_user_project_idx ON entity_tombstones(user_id, project_id);
CREATE INDEX IF NOT EXISTS entity_tombstones_user_rev_idx ON entity_tombstones(user_id, deleted_revision);
CREATE INDEX IF NOT EXISTS entity_tombstones_user_entity_idx ON entity_tombstones(user_id, entity_id);

CREATE TABLE IF NOT EXISTS workspace_sync_state (
  user_id TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS recovery_operations (
  user_id TEXT NOT NULL,
  operation_key TEXT NOT NULL,
  source_chapter_id TEXT NOT NULL,
  source_base_revision TEXT,
  draft_id TEXT,
  payload_hash TEXT NOT NULL,
  recovery_chapter_id TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (user_id, operation_key)
);

CREATE INDEX IF NOT EXISTS recovery_ops_user_rec_idx ON recovery_operations(user_id, recovery_chapter_id);
CREATE INDEX IF NOT EXISTS recovery_ops_user_source_idx ON recovery_operations(user_id, source_chapter_id);

-- SQL Write-time Invariant Triggers
CREATE TRIGGER IF NOT EXISTS trg_prevent_insert_deleted_chapter
BEFORE INSERT ON chapters
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM entity_tombstones t
  JOIN projects p ON p.id = NEW.project_id
  WHERE t.user_id = p.user_id
    AND t.entity_type = 'chapter'
    AND t.entity_id = NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'CHAPTER_DELETED: Cannot insert chapter with tombstoned ID');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_insert_chapter_deleted_project
BEFORE INSERT ON chapters
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM entity_tombstones t
  WHERE t.entity_type = 'project'
    AND t.entity_id = NEW.project_id
)
BEGIN
  SELECT RAISE(ABORT, 'PROJECT_DELETED: Cannot insert chapter into deleted project');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_insert_chapter_deleted_parent
BEFORE INSERT ON chapters
FOR EACH ROW
WHEN NEW.parent_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM entity_tombstones t
  WHERE t.entity_type = 'chapter'
    AND t.entity_id = NEW.parent_id
)
BEGIN
  SELECT RAISE(ABORT, 'PARENT_DELETED: Cannot insert chapter into deleted parent');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_reparent_chapter_deleted_parent
BEFORE UPDATE OF parent_id ON chapters
FOR EACH ROW
WHEN NEW.parent_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM entity_tombstones t
  WHERE t.entity_type = 'chapter'
    AND t.entity_id = NEW.parent_id
)
BEGIN
  SELECT RAISE(ABORT, 'PARENT_DELETED: Cannot reparent chapter to deleted parent');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_insert_deleted_project
BEFORE INSERT ON projects
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM entity_tombstones t
  WHERE t.user_id = NEW.user_id
    AND t.entity_type = 'project'
    AND t.entity_id = NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'PROJECT_DELETED: Cannot insert project with tombstoned ID');
END;
