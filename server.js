import db from "./db.js";
import config from "./config.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");

/**
 * Parses JSON body from request
 */
async function parseBody(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * Returns JSON response with proper headers
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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

  // API routes
  if (pathname.startsWith("/api/todos")) {
    // GET /api/todos - list all todos
    if (method === "GET" && pathname === "/api/todos") {
      const todos = db.query("SELECT * FROM todos ORDER BY created_at DESC").all();
      return jsonResponse(todos);
    }

    // POST /api/todos - create new todo
    if (method === "POST" && pathname === "/api/todos") {
      const body = await parseBody(req);
      if (!body?.title) {
        return jsonResponse({ error: "Title is required" }, 400);
      }
      const dueDate = body.due_date || null;
      const priority = body.priority || null;
      const status = body.status || 'todo';
      const result = db.run(
        "INSERT INTO todos (title, due_date, priority, status) VALUES (?, ?, ?, ?)",
        [body.title, dueDate, priority, status]
      );
      const todo = db.query("SELECT * FROM todos WHERE id = ?").get(result.lastInsertRowid);
      return jsonResponse(todo, 201);
    }

    // PUT /api/todos/:id - update todo
    const putMatch = pathname.match(/^\/api\/todos\/(\d+)$/);
    if (method === "PUT" && putMatch) {
      const id = putMatch[1];
      const body = await parseBody(req);
      const existing = db.query("SELECT * FROM todos WHERE id = ?").get(id);

      if (!existing) {
        return jsonResponse({ error: "Todo not found" }, 404);
      }

      const title = body?.title ?? existing.title;
      const newStatus = body?.status ?? existing.status;
      const completed = newStatus === 'done' ? 1 : 0;
      const dueDate = body?.due_date !== undefined ? body.due_date : existing.due_date;
      const priority = body?.priority !== undefined ? body.priority : existing.priority;

      // Set completed_at when moving to done, clear it when moving away from done
      let completedAt = existing.completed_at;
      if (newStatus === 'done' && existing.status !== 'done') {
        completedAt = new Date().toISOString();
      } else if (newStatus !== 'done') {
        completedAt = null;
      }

      db.run(
        "UPDATE todos SET title = ?, completed = ?, status = ?, due_date = ?, priority = ?, completed_at = ? WHERE id = ?",
        [title, completed, newStatus, dueDate, priority, completedAt, id]
      );
      const updated = db.query("SELECT * FROM todos WHERE id = ?").get(id);
      return jsonResponse(updated);
    }

    // DELETE /api/todos/:id - delete todo
    const deleteMatch = pathname.match(/^\/api\/todos\/(\d+)$/);
    if (method === "DELETE" && deleteMatch) {
      const id = deleteMatch[1];
      const existing = db.query("SELECT * FROM todos WHERE id = ?").get(id);

      if (!existing) {
        return jsonResponse({ error: "Todo not found" }, 404);
      }

      db.run("DELETE FROM todos WHERE id = ?", [id]);
      return jsonResponse({ success: true });
    }
  }

  // Serve static files
  return serveStatic(pathname);
}

console.log(`Todo app starting...`);
console.log(`  Config: ${config.configFile}`);
console.log(`  Database: ${config.dbPath}`);
console.log(`  Server: http://${config.host}:${config.port}`);

export default {
  port: config.port,
  fetch: handler,
};
