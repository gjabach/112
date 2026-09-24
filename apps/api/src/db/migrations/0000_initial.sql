-- Initial migration for Novelist App
-- Generated manually for D1 SQLite

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  password_hash TEXT NOT NULL,
  ai_provider TEXT,
  ai_api_key TEXT,
  ai_model TEXT,
  preferences TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  genre TEXT,
  cover_image_url TEXT,
  word_count_goal INTEGER,
  status TEXT NOT NULL DEFAULT 'planning',
  settings TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  content_format TEXT NOT NULL DEFAULT 'tiptap-json',
  summary TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'outline',
  parent_id TEXT,
  notes TEXT,
  pov TEXT,
  location TEXT,
  characters_present TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chapters_project_id_idx ON chapters(project_id);
CREATE INDEX IF NOT EXISTS chapters_order_idx ON chapters(order_index);

CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY NOT NULL,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  order_index INTEGER NOT NULL,
  goal TEXT,
  conflict TEXT,
  outcome TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS scenes_chapter_id_idx ON scenes(chapter_id);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  aliases TEXT,
  role TEXT,
  avatar_url TEXT,
  age TEXT,
  gender TEXT,
  occupation TEXT,
  appearance TEXT,
  personality TEXT,
  background TEXT,
  motivation TEXT,
  character_arc TEXT,
  fears TEXT,
  desires TEXT,
  strengths TEXT,
  weaknesses TEXT,
  speech_pattern TEXT,
  secrets TEXT,
  relationships TEXT,
  custom_fields TEXT,
  tags TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS characters_project_id_idx ON characters(project_id);
CREATE INDEX IF NOT EXISTS characters_name_idx ON characters(name);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  parent_id TEXT,
  description TEXT,
  geography TEXT,
  climate TEXT,
  population TEXT,
  government TEXT,
  culture TEXT,
  history TEXT,
  image_url TEXT,
  map_coordinates TEXT,
  custom_fields TEXT,
  tags TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS locations_project_id_idx ON locations(project_id);

CREATE TABLE IF NOT EXISTS world_entities (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  attributes TEXT,
  image_url TEXT,
  related_entity_ids TEXT,
  tags TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS world_entities_project_id_idx ON world_entities(project_id);
CREATE INDEX IF NOT EXISTS world_entities_type_idx ON world_entities(type);

CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  date_in_story TEXT,
  date_real_world TEXT,
  era TEXT,
  importance TEXT,
  involved_character_ids TEXT,
  location_id TEXT,
  chapter_id TEXT,
  order_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS timeline_events_project_id_idx ON timeline_events(project_id);

CREATE TABLE IF NOT EXISTS outline_nodes (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'idea',
  linked_chapter_id TEXT,
  color TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS outline_nodes_project_id_idx ON outline_nodes(project_id);

CREATE TABLE IF NOT EXISTS revisions (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  content TEXT NOT NULL,
  word_count INTEGER,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  label TEXT
);
CREATE INDEX IF NOT EXISTS revisions_entity_idx ON revisions(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT,
  title TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  context_type TEXT,
  context_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_conversations_user_id_idx ON ai_conversations(user_id);

CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_messages_conversation_id_idx ON ai_messages(conversation_id);

CREATE TABLE IF NOT EXISTS prompt_templates (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  template TEXT NOT NULL,
  variables TEXT,
  description TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT,
  name TEXT NOT NULL,
  color TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS entity_tags (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS entity_tags_entity_idx ON entity_tags(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT,
  title TEXT NOT NULL,
  content TEXT,
  color TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS writing_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT,
  chapter_id TEXT,
  words_written INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  ended_at INTEGER
);

CREATE TABLE IF NOT EXISTS export_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  file_url TEXT,
  options TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

-- Seed built-in prompt templates
INSERT INTO prompt_templates (id, user_id, name, category, template, variables, description, is_public, created_at) VALUES
('prompt_continue', NULL, 'Viết tiếp', 'generate', 'Tiếp tục câu chuyện từ đoạn sau:\n\n{{content}}\n\nGiữ giọng văn: {{tone}}', '["content","tone"]', 'Viết tiếp câu chuyện', 1, 0),
('prompt_rewrite', NULL, 'Viết lại', 'rewrite', 'Viết lại đoạn sau cho hay hơn:\n\n{{content}}\n\nPhong cách: {{style}}', '["content","style"]', 'Viết lại đoạn văn', 1, 0),
('prompt_critique', NULL, 'Phê bình', 'critique', 'Phê bình đoạn văn sau về nhịp độ, nhân vật, hội thoại:\n\n{{content}}', '["content"]', 'Nhận xét chi tiết', 1, 0);
