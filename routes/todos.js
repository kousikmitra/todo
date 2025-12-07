import db from "../db.js";
import { parseBody, jsonResponse } from "../utils.js";

/**
 * Handles all todo-related API routes
 */
export async function handleTodosRoutes(req, pathname, method) {
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
    // Store links as JSON array for future multi-link support
    const links = body.link ? JSON.stringify([body.link]) : null;
    const result = db.run(
      "INSERT INTO todos (title, due_date, priority, status, links) VALUES (?, ?, ?, ?, ?)",
      [body.title, dueDate, priority, status, links]
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
    
    // Handle link update - store as JSON array for future multi-link support
    let links = existing.links;
    if (body?.link !== undefined) {
      links = body.link ? JSON.stringify([body.link]) : null;
    }

    // Set completed_at when moving to done, clear it when moving away from done
    let completedAt = existing.completed_at;
    if (newStatus === 'done' && existing.status !== 'done') {
      completedAt = new Date().toISOString();
    } else if (newStatus !== 'done') {
      completedAt = null;
    }

    db.run(
      "UPDATE todos SET title = ?, completed = ?, status = ?, due_date = ?, priority = ?, completed_at = ?, links = ? WHERE id = ?",
      [title, completed, newStatus, dueDate, priority, completedAt, links, id]
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

  return null;
}

