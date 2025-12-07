import config from "./config.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { jsonResponse, log } from "./utils.js";
import { handleTodosRoutes } from "./routes/todos.js";
import { handleWidgetsRoutes } from "./routes/widgets.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");

/**
 * Serves static files from public directory
 */
async function serveStatic(pathname) {
  const filePath = pathname === "/"
    ? join(PUBLIC_DIR, "index.html")
    : join(PUBLIC_DIR, pathname);
  const file = Bun.file(filePath);

  if (await file.exists()) {
    return new Response(file);
  }
  return new Response("Not Found", { status: 404 });
}

/**
 * Main request handler
 */
async function handler(req) {
  const url = new URL(req.url);
  const { pathname } = url;
  const method = req.method;

  // GET /api/config - get client config
  if (method === "GET" && pathname === "/api/config") {
    return jsonResponse({
      hidden: config.hidden
    });
  }

  // Route to todos handler
  if (pathname.startsWith("/api/todos")) {
    const response = await handleTodosRoutes(req, pathname, method);
    if (response) return response;
  }

  // Route to widgets handler
  if (pathname.startsWith("/api/widgets")) {
    const response = await handleWidgetsRoutes(req, pathname, method);
    if (response) return response;
  }

  // Serve static files
  return serveStatic(pathname);
}

log(`Todo app starting in ${config.isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode...`);
log(`Config: ${config.configFile}`);
log(`Database: ${config.dbPath}`);
log(`Server: http://${config.host}:${config.port}`);

export default {
  port: config.port,
  fetch: handler,
};
