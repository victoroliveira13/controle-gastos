import { integer, sqliteTable, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const categoryGroups = sqliteTable('category_groups', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	code: text('code').notNull().unique(),
	name: text('name').notNull(),
	isIncome: integer('is_income', { mode: 'boolean' }).notNull().default(false)
});

export const categories = sqliteTable('categories', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	groupId: integer('group_id')
		.notNull()
		.references(() => categoryGroups.id),
	code: text('code').notNull().unique(),
	name: text('name').notNull(),
	isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true)
});

export const budgets = sqliteTable('budgets', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	categoryId: integer('category_id')
		.notNull()
		.references(() => categories.id),
	month: text('month').notNull(), // YYYY-MM
	amount: real('amount').notNull().default(0),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`)
});

export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

export const monthlyNotes = sqliteTable('monthly_notes', {
	month: text('month').primaryKey(), // YYYY-MM
	imprevisto: text('imprevisto').default(''),
	superfluous: text('superfluous').default(''),
	coverage: text('coverage').default(''),
	observations: text('observations').default(''),
	updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`)
});

export const transactions = sqliteTable('transactions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	categoryId: integer('category_id')
		.notNull()
		.references(() => categories.id),
	amount: real('amount').notNull(),
	type: text('type', { enum: ['income', 'expense'] }).notNull(),
	date: text('date').notNull(), // YYYY-MM-DD
	description: text('description'),
	pluggyTxId: text('pluggy_tx_id'), // Pluggy transaction ID for deduplication
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`)
});

// Pluggy connected bank items (persisted after user connects via widget)
export const pluggyItems = sqliteTable('pluggy_items', {
	id: text('id').primaryKey(), // Pluggy item ID
	name: text('name').notNull().default('Banco'), // institution name
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`)
});
