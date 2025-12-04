import { homedir } from "os";
import { join, dirname } from "path";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME = homedir();

// Detect if running from installed location or development
const INSTALL_DIR = join(HOME, ".local", "share", "todos");
const IS_PRODUCTION = __dirname.startsWith(INSTALL_DIR);

// Standard macOS paths for production
const CONFIG_DIR = join(HOME, ".config", "todos");
const DATA_DIR = join(HOME, "Library", "Application Support", "todos");

// Development paths (local to project)
const DEV_DB_PATH = join(__dirname, "todo.db");

// Ensure directories exist (only for production)
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// Config file path (always in ~/.config/todos for both modes)
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

// Default configuration
const DEFAULT_CONFIG = {
  port: 5555,
  host: "localhost",
  hidden: false
};

const DEV_PORT = 3000;

/**
 * Load configuration, creating default if it doesn't exist
 */
function loadConfig() {
  ensureDir(CONFIG_DIR);

  if (!existsSync(CONFIG_FILE)) {
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return DEFAULT_CONFIG;
  }

  try {
    const content = readFileSync(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

const config = loadConfig();

// In production, ensure data directory exists
if (IS_PRODUCTION) {
  ensureDir(DATA_DIR);
}

// Select port and db path based on mode
const activePort = IS_PRODUCTION ? config.port : DEV_PORT;
const activeDbPath = IS_PRODUCTION ? join(DATA_DIR, "todos.db") : DEV_DB_PATH;

export default {
  port: activePort,
  host: config.host,
  hidden: config.hidden,
  isProduction: IS_PRODUCTION,
  configDir: CONFIG_DIR,
  dataDir: IS_PRODUCTION ? DATA_DIR : __dirname,
  dbPath: activeDbPath,
  configFile: CONFIG_FILE
};
