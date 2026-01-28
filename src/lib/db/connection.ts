import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Database file path - relative to project root
const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') ||
  path.join(process.cwd(), 'data', 'schools.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Initialize database with schema
export function initializeDatabase(): void {
  const database = getDatabase();
  const schemaPath = path.join(__dirname, 'schema.sql');

  // Read and execute schema if file exists
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    database.exec(schema);
  }
}

// Check if database has been seeded
export function isDatabaseSeeded(): boolean {
  const database = getDatabase();
  try {
    const result = database.prepare('SELECT COUNT(*) as count FROM schools').get() as { count: number };
    return result.count > 0;
  } catch {
    return false;
  }
}

export { DB_PATH };
