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

// Migrate old completed field to status
db.run("UPDATE todos SET status = 'done' WHERE completed = 1 AND (status IS NULL OR status = 'todo')");
db.run("UPDATE todos SET status = 'todo' WHERE status IS NULL");

export default db;
