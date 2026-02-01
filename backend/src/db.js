import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = join(__dirname, '..', 'data');
const uploadsDir = join(__dirname, '..', 'uploads');

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

export { uploadsDir };

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

  CREATE TABLE IF NOT EXISTS recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER NOT NULL,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    duration INTEGER,
    transcript TEXT,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('recording', 'processing', 'completed', 'failed')),
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER NOT NULL,
    recordingId INTEGER,
    decisionId INTEGER,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (recordingId) REFERENCES recordings(id) ON DELETE SET NULL,
    FOREIGN KEY (decisionId) REFERENCES decisions(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_recordings_project ON recordings(projectId);
  CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(projectId);
  CREATE INDEX IF NOT EXISTS idx_tasks_recording ON tasks(recordingId);
  CREATE INDEX IF NOT EXISTS idx_tasks_decision ON tasks(decisionId);
`);

export default db;
