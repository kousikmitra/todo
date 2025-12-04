import db from "./db.js";

const PORT = 3000;

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
  const filePath = pathname === "/" ? "./public/index.html" : `./public${pathname}`;
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
      const status = body?.status ?? existing.status;
      const completed = status === 'done' ? 1 : 0;
      const dueDate = body?.due_date !== undefined ? body.due_date : existing.due_date;
      const priority = body?.priority !== undefined ? body.priority : existing.priority;
      
      db.run(
        "UPDATE todos SET title = ?, completed = ?, status = ?, due_date = ?, priority = ? WHERE id = ?",
        [title, completed, status, dueDate, priority, id]
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

console.log(`Server running at http://localhost:${PORT}`);

export default {
  port: PORT,
  fetch: handler,
};
