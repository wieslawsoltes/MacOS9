import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const disks = sqliteTable('platinum_disks', {
  id: text('id').primaryKey(),
  version: integer('version').notNull(),
  objectKey: text('object_key').notNull(),
  updated: integer('updated').notNull(),
});
