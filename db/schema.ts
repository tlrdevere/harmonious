import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  revision: integer('revision').notNull(),
  content: text('content').notNull(),
  updatedAt: integer('updated_at').notNull()
});
