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

  -- Tags system
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#667eea',
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(projectId, name)
  );

  CREATE TABLE IF NOT EXISTS decision_tags (
    decisionId INTEGER NOT NULL,
    tagId INTEGER NOT NULL,
    PRIMARY KEY (decisionId, tagId),
    FOREIGN KEY (decisionId) REFERENCES decisions(id) ON DELETE CASCADE,
    FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tags_project ON tags(projectId);
  CREATE INDEX IF NOT EXISTS idx_decision_tags_decision ON decision_tags(decisionId);
  CREATE INDEX IF NOT EXISTS idx_decision_tags_tag ON decision_tags(tagId);

  -- Decision relations for graph
  CREATE TABLE IF NOT EXISTS decision_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fromDecisionId INTEGER NOT NULL,
    toDecisionId INTEGER NOT NULL,
    relationType TEXT NOT NULL CHECK (relationType IN ('supersedes', 'relates', 'blocks', 'implements')),
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (fromDecisionId) REFERENCES decisions(id) ON DELETE CASCADE,
    FOREIGN KEY (toDecisionId) REFERENCES decisions(id) ON DELETE CASCADE,
    UNIQUE(fromDecisionId, toDecisionId)
  );

  CREATE INDEX IF NOT EXISTS idx_relations_from ON decision_relations(fromDecisionId);
  CREATE INDEX IF NOT EXISTS idx_relations_to ON decision_relations(toDecisionId);
`);

// Add embedding column if not exists (for smart search)
try {
  db.exec(`ALTER TABLE decisions ADD COLUMN embedding BLOB`);
} catch (e) {
  // Column already exists
}

export default db;
