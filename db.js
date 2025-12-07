import { Database } from "bun:sqlite";
import config from "./config.js";

const db = new Database(config.dbPath);

db.run(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    status TEXT DEFAULT 'todo',
    due_date TEXT,
    priority TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Add columns if they don't exist (for existing databases)
try { db.run("ALTER TABLE todos ADD COLUMN due_date TEXT"); } catch { }
try { db.run("ALTER TABLE todos ADD COLUMN priority TEXT"); } catch { }
try { db.run("ALTER TABLE todos ADD COLUMN status TEXT DEFAULT 'todo'"); } catch { }
try { db.run("ALTER TABLE todos ADD COLUMN completed_at TEXT"); } catch { }
try { db.run("ALTER TABLE todos ADD COLUMN links TEXT"); } catch { }

// Migrate old completed field to status
db.run("UPDATE todos SET status = 'done' WHERE completed = 1 AND (status IS NULL OR status = 'todo')");
db.run("UPDATE todos SET status = 'todo' WHERE status IS NULL");

// Widget tables for dashboard
db.run(`
  CREATE TABLE IF NOT EXISTS widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    x INTEGER DEFAULT 0,
    y INTEGER DEFAULT 0,
    width INTEGER DEFAULT 2,
    height INTEGER DEFAULT 2,
    z_index INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS widget_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    widget_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    FOREIGN KEY (widget_id) REFERENCES widgets(id) ON DELETE CASCADE,
    UNIQUE(widget_id, key)
  )
`);

export default db;
