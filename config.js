import { homedir } from "os";
import { join } from "path";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "fs";

const HOME = homedir();

// Standard macOS paths
const CONFIG_DIR = join(HOME, ".config", "todos");
const DATA_DIR = join(HOME, "Library", "Application Support", "todos");

// Ensure directories exist
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

ensureDir(CONFIG_DIR);
ensureDir(DATA_DIR);

// Config file path
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

// Default configuration
const DEFAULT_CONFIG = {
  port: 5555,
  host: "localhost"
};

/**
 * Load configuration, creating default if it doesn't exist
 */
function loadConfig() {
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

export default {
  port: config.port,
  host: config.host,
  configDir: CONFIG_DIR,
  dataDir: DATA_DIR,
  dbPath: join(DATA_DIR, "todos.db"),
  configFile: CONFIG_FILE
};

