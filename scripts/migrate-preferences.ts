/**
 * Migration script to convert structured preferences to text-based preferences
 *
 * This script:
 * 1. Reads existing structured preferences
 * 2. Converts them to natural language instructions
 * 3. Drops old tables and creates new simplified schema
 * 4. Inserts converted preferences
 *
 * Run with: npx tsx scripts/migrate-preferences.ts
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'finance.db');

interface OldPreference {
  id: number;
  preference_type: string;
  merchant_pattern: string;
  merchant_name: string | null;
  category: string | null;
  subcategory: string | null;
  is_transfer: number;
  source: string;
  match_type: string;
  keywords: string | null;
  amount_min: number | null;
  amount_max: number | null;
  amount_sign: string;
}

function convertToNaturalLanguage(pref: OldPreference): string {
  const name = pref.merchant_name || pref.merchant_pattern;
  const keywords = pref.keywords ? JSON.parse(pref.keywords) as string[] : null;

  let instruction = '';

  // Build the matching part
  if (pref.match_type === 'exact') {
    instruction = `"${name}"`;
  } else if (pref.match_type === 'contains') {
    instruction = `Transactions containing "${pref.merchant_pattern}"`;
  } else if (pref.match_type === 'contains_all' && keywords) {
    instruction = `Transactions containing all of: ${keywords.join(', ')}`;
  } else if (pref.match_type === 'contains_any' && keywords) {
    instruction = `Transactions containing any of: ${keywords.join(' or ')}`;
  } else {
    instruction = `"${name}"`;
  }

  // Add amount conditions
  if (pref.amount_sign === 'expense') {
    instruction += ' (expenses only)';
  } else if (pref.amount_sign === 'income') {
    instruction += ' (income only)';
  }

  if (pref.amount_min !== null && pref.amount_max !== null) {
    instruction += ` between $${pref.amount_min} and $${pref.amount_max}`;
  } else if (pref.amount_min !== null) {
    instruction += ` over $${pref.amount_min}`;
  } else if (pref.amount_max !== null) {
    instruction += ` under $${pref.amount_max}`;
  }

  // Add categorization
  if (pref.is_transfer) {
    instruction += ' should be marked as a transfer';
    if (pref.category) {
      instruction += ` (${pref.category}${pref.subcategory ? ` / ${pref.subcategory}` : ''})`;
    }
  } else if (pref.category) {
    instruction += ` should be categorized as ${pref.category}`;
    if (pref.subcategory) {
      instruction += ` / ${pref.subcategory}`;
    }
  }

  return instruction;
}

function migrate() {
  console.log('Starting preference migration...\n');

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Check if old schema exists
  const hasOldSchema = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='user_preferences'
  `).get();

  if (!hasOldSchema) {
    console.log('No existing user_preferences table found. Creating new schema...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instruction TEXT NOT NULL,
        source TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('New schema created successfully.');
    db.close();
    return;
  }

  // Check if already migrated (new schema has 'instruction' column)
  const columns = db.prepare(`PRAGMA table_info(user_preferences)`).all() as { name: string }[];
  const hasInstructionColumn = columns.some(col => col.name === 'instruction');

  if (hasInstructionColumn) {
    console.log('Preferences already migrated to text-based format.');

    // Still drop merchant_cache if it exists
    const hasMerchantCache = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='merchant_cache'
    `).get();

    if (hasMerchantCache) {
      console.log('Dropping merchant_cache table...');
      db.exec('DROP TABLE IF EXISTS merchant_cache');
      console.log('merchant_cache table dropped.');
    }

    db.close();
    return;
  }

  // Read existing preferences
  console.log('Reading existing structured preferences...');
  const oldPreferences = db.prepare(`
    SELECT * FROM user_preferences WHERE preference_type = 'categorization'
  `).all() as OldPreference[];

  console.log(`Found ${oldPreferences.length} preferences to convert.\n`);

  // Convert to natural language
  const convertedPreferences = oldPreferences.map(pref => {
    const instruction = convertToNaturalLanguage(pref);
    const source = pref.source === 'user_correction' ? 'learned' : 'user';
    console.log(`  [${source}] ${instruction}`);
    return { instruction, source };
  });

  console.log('\nDropping old tables and creating new schema...');

  // Drop old tables and create new schema
  db.exec(`
    DROP TABLE IF EXISTS user_preferences;
    DROP TABLE IF EXISTS merchant_cache;
    DROP INDEX IF EXISTS idx_user_preferences_merchant;

    CREATE TABLE user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instruction TEXT NOT NULL,
      source TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert converted preferences
  console.log('Inserting converted preferences...');
  const insertStmt = db.prepare(`
    INSERT INTO user_preferences (instruction, source) VALUES (?, ?)
  `);

  for (const pref of convertedPreferences) {
    insertStmt.run(pref.instruction, pref.source);
  }

  console.log(`\nMigration complete! Converted ${convertedPreferences.length} preferences.`);

  // Verify
  const count = db.prepare('SELECT COUNT(*) as count FROM user_preferences').get() as { count: number };
  console.log(`Verified: ${count.count} preferences in new table.`);

  db.close();
}

// Run migration
migrate();
