import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const accounts = sqliteTable('accounts', {
 id: text('id').primaryKey(), username: text('username').notNull().unique(), passwordHash: text('password_hash').notNull(), recoveryHash: text('recovery_hash').notNull(),
 company: text('company').notNull(), work: text('work').notNull(), street: text('street').notNull(), houseNumber: text('house_number').notNull(), postalCode: text('postal_code').notNull(), city: text('city').notNull(), country: text('country').notNull(),
 accessStatus: text('access_status').notNull().default('pilot'), termsVersion: text('terms_version').notNull(), createdAt: integer('created_at').notNull()
});
export const sessions=sqliteTable('sessions',{tokenHash:text('token_hash').primaryKey(),accountId:text('account_id').notNull().references(()=>accounts.id,{onDelete:'cascade'}),expiresAt:integer('expires_at').notNull(),createdAt:integer('created_at').notNull()},t=>[index('sessions_account_idx').on(t.accountId)]);
export const favorites=sqliteTable('favorites',{accountId:text('account_id').notNull().references(()=>accounts.id,{onDelete:'cascade'}),lawId:text('law_id').notNull()},t=>[primaryKey({columns:[t.accountId,t.lawId]})]);
export const limits=sqliteTable('rate_limits',{key:text('key').primaryKey(),attempts:integer('attempts').notNull(),resetAt:integer('reset_at').notNull()});
export const runs=sqliteTable('legal_runs',{id:text('id').primaryKey(),status:text('status').notNull(),cursor:integer('cursor').notNull().default(0),startedAt:integer('started_at').notNull(),finishedAt:integer('finished_at'),error:text('error'),changed:integer('changed').notNull().default(0),owner:text('owner').notNull()});
export const entries=sqliteTable('legal_entries',{runId:text('run_id').notNull().references(()=>runs.id,{onDelete:'cascade'}),lawId:text('law_id').notNull(),payload:text('payload').notNull(),sourceHash:text('source_hash').notNull()},t=>[primaryKey({columns:[t.runId,t.lawId]})]);
export const settings=sqliteTable('legal_settings',{key:text('key').primaryKey(),value:text('value').notNull()});
