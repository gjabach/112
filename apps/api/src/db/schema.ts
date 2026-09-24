import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// USERS
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash').notNull(),
  aiProvider: text('ai_provider'),
  aiApiKey: text('ai_api_key'), // encrypted
  aiModel: text('ai_model'),
  preferences: text('preferences'), // JSON
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

// SESSIONS
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull()
}, (table) => ({
  userIdIdx: index('sessions_user_id_idx').on(table.userId)
}));

// PROJECTS
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  description: text('description'),
  genre: text('genre'),
  coverImageUrl: text('cover_image_url'),
  wordCountGoal: integer('word_count_goal'),
  status: text('status').notNull().default('planning'),
  settings: text('settings'), // JSON
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => ({
  userIdIdx: index('projects_user_id_idx').on(table.userId),
  statusIdx: index('projects_status_idx').on(table.status)
}));

// CHAPTERS
export const chapters = sqliteTable('chapters', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content'),
  contentFormat: text('content_format').notNull().default('tiptap-json'),
  summary: text('summary'),
  wordCount: integer('word_count').notNull().default(0),
  orderIndex: integer('order_index').notNull(),
  status: text('status').notNull().default('outline'),
  parentId: text('parent_id'),
  notes: text('notes'),
  pov: text('pov'),
  location: text('location'),
  charactersPresent: text('characters_present'), // JSON array
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => ({
  projectIdIdx: index('chapters_project_id_idx').on(table.projectId),
  orderIdx: index('chapters_order_idx').on(table.orderIndex)
}));

// SCENES
export const scenes = sqliteTable('scenes', {
  id: text('id').primaryKey(),
  chapterId: text('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content'),
  summary: text('summary'),
  orderIndex: integer('order_index').notNull(),
  goal: text('goal'),
  conflict: text('conflict'),
  outcome: text('outcome'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => ({
  chapterIdIdx: index('scenes_chapter_id_idx').on(table.chapterId)
}));

// CHARACTERS
export const characters = sqliteTable('characters', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  aliases: text('aliases'), // JSON
  role: text('role'),
  avatarUrl: text('avatar_url'),
  age: text('age'),
  gender: text('gender'),
  occupation: text('occupation'),
  appearance: text('appearance'),
  personality: text('personality'),
  background: text('background'),
  motivation: text('motivation'),
  characterArc: text('character_arc'),
  fears: text('fears'),
  desires: text('desires'),
  strengths: text('strengths'),
  weaknesses: text('weaknesses'),
  speechPattern: text('speech_pattern'),
  secrets: text('secrets'),
  relationships: text('relationships'), // JSON
  customFields: text('custom_fields'), // JSON
  tags: text('tags'), // JSON
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => ({
  projectIdIdx: index('characters_project_id_idx').on(table.projectId),
  nameIdx: index('characters_name_idx').on(table.name)
}));

// LOCATIONS
export const locations = sqliteTable('locations', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type'),
  parentId: text('parent_id'),
  description: text('description'),
  geography: text('geography'),
  climate: text('climate'),
  population: text('population'),
  government: text('government'),
  culture: text('culture'),
  history: text('history'),
  imageUrl: text('image_url'),
  mapCoordinates: text('map_coordinates'), // JSON {x,y}
  customFields: text('custom_fields'), // JSON
  tags: text('tags'), // JSON
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => ({
  projectIdIdx: index('locations_project_id_idx').on(table.projectId)
}));

// WORLD ENTITIES
export const worldEntities = sqliteTable('world_entities', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  attributes: text('attributes'), // JSON
  imageUrl: text('image_url'),
  relatedEntityIds: text('related_entity_ids'), // JSON
  tags: text('tags'), // JSON
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => ({
  projectIdIdx: index('world_entities_project_id_idx').on(table.projectId),
  typeIdx: index('world_entities_type_idx').on(table.type)
}));

// TIMELINE EVENTS
export const timelineEvents = sqliteTable('timeline_events', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  dateInStory: text('date_in_story'),
  dateRealWorld: text('date_real_world'),
  era: text('era'),
  importance: text('importance'),
  involvedCharacterIds: text('involved_character_ids'), // JSON
  locationId: text('location_id'),
  chapterId: text('chapter_id'),
  orderIndex: integer('order_index').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => ({
  projectIdIdx: index('timeline_events_project_id_idx').on(table.projectId)
}));

// OUTLINE NODES
export const outlineNodes = sqliteTable('outline_nodes', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  parentId: text('parent_id'),
  type: text('type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  orderIndex: integer('order_index').notNull(),
  status: text('status').notNull().default('idea'),
  linkedChapterId: text('linked_chapter_id'),
  color: text('color'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => ({
  projectIdIdx: index('outline_nodes_project_id_idx').on(table.projectId)
}));

// REVISIONS
export const revisions = sqliteTable('revisions', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  content: text('content').notNull(),
  wordCount: integer('word_count'),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at').notNull(),
  label: text('label')
}, (table) => ({
  entityIdx: index('revisions_entity_idx').on(table.entityType, table.entityId)
}));

// AI CONVERSATIONS
export const aiConversations = sqliteTable('ai_conversations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id'),
  title: text('title'),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  contextType: text('context_type'),
  contextId: text('context_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => ({
  userIdIdx: index('ai_conversations_user_id_idx').on(table.userId)
}));

export const aiMessages = sqliteTable('ai_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => aiConversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  tokenCount: integer('token_count'),
  createdAt: integer('created_at').notNull()
}, (table) => ({
  conversationIdIdx: index('ai_messages_conversation_id_idx').on(table.conversationId)
}));

// PROMPT TEMPLATES
export const promptTemplates = sqliteTable('prompt_templates', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  name: text('name').notNull(),
  category: text('category').notNull(),
  template: text('template').notNull(),
  variables: text('variables'), // JSON
  description: text('description'),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull()
});

// TAGS
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id'),
  name: text('name').notNull(),
  color: text('color'),
  createdAt: integer('created_at').notNull()
});

// ENTITY TAGS (many-to-many)
export const entityTags = sqliteTable('entity_tags', {
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' })
}, (table) => ({
  entityIdx: index('entity_tags_entity_idx').on(table.entityType, table.entityId)
}));

// NOTES
export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id'),
  title: text('title').notNull(),
  content: text('content'),
  color: text('color'),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

// WRITING SESSIONS
export const writingSessions = sqliteTable('writing_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id'),
  chapterId: text('chapter_id'),
  wordsWritten: integer('words_written').notNull().default(0),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at')
});

// EXPORT JOBS
export const exportJobs = sqliteTable('export_jobs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  format: text('format').notNull(),
  status: text('status').notNull().default('pending'),
  fileUrl: text('file_url'),
  options: text('options'), // JSON
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at')
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  projects: many(projects)
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  chapters: many(chapters),
  characters: many(characters),
  locations: many(locations)
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  project: one(projects, { fields: [chapters.projectId], references: [projects.id] }),
  scenes: many(scenes)
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
