import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = join(__dirname, '..', 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const db = new Database(join(dataDir, 'brain.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    reason TEXT,
    consequences TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    decisionId INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('commit', 'pr', 'task', 'file', 'note')),
    reference TEXT NOT NULL,
    FOREIGN KEY (decisionId) REFERENCES decisions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(projectId);
  CREATE INDEX IF NOT EXISTS idx_links_decision ON links(decisionId);
`);

export default db;
