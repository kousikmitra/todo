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

  // GET /api/config - get client config
  if (method === "GET" && pathname === "/api/config") {
    return jsonResponse({
      hidden: config.hidden
    });
  }

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

  // Widget API routes
  if (pathname.startsWith("/api/widgets")) {
    // GET /api/widgets - list all widgets with settings
    if (method === "GET" && pathname === "/api/widgets") {
      const widgets = db.query("SELECT * FROM widgets ORDER BY z_index ASC").all();
      const widgetsWithSettings = widgets.map(widget => {
        const settings = db.query(
          "SELECT key, value FROM widget_settings WHERE widget_id = ?"
        ).all(widget.id);
        const settingsObj = {};
        settings.forEach(s => { settingsObj[s.key] = s.value; });
        return { ...widget, settings: settingsObj };
      });
      return jsonResponse(widgetsWithSettings);
    }

    // POST /api/widgets - create new widget
    if (method === "POST" && pathname === "/api/widgets") {
      const body = await parseBody(req);
      if (!body?.type) {
        return jsonResponse({ error: "Widget type is required" }, 400);
      }
      const { type, x = 0, y = 0, width = 2, height = 2, settings = {} } = body;

      const maxZ = db.query("SELECT MAX(z_index) as max_z FROM widgets").get();
      const zIndex = (maxZ?.max_z || 0) + 1;

      const result = db.run(
        "INSERT INTO widgets (type, x, y, width, height, z_index) VALUES (?, ?, ?, ?, ?, ?)",
        [type, x, y, width, height, zIndex]
      );
      const widgetId = result.lastInsertRowid;

      for (const [key, value] of Object.entries(settings)) {
        db.run(
          "INSERT INTO widget_settings (widget_id, key, value) VALUES (?, ?, ?)",
          [widgetId, key, String(value)]
        );
      }

      const widget = db.query("SELECT * FROM widgets WHERE id = ?").get(widgetId);
      return jsonResponse({ ...widget, settings }, 201);
    }

    // PUT /api/widgets/:id - update widget position/size
    const widgetPutMatch = pathname.match(/^\/api\/widgets\/(\d+)$/);
    if (method === "PUT" && widgetPutMatch) {
      const id = widgetPutMatch[1];
      const body = await parseBody(req);
      const existing = db.query("SELECT * FROM widgets WHERE id = ?").get(id);

      if (!existing) {
        return jsonResponse({ error: "Widget not found" }, 404);
      }

      const x = body?.x ?? existing.x;
      const y = body?.y ?? existing.y;
      const width = body?.width ?? existing.width;
      const height = body?.height ?? existing.height;
      const zIndex = body?.z_index ?? existing.z_index;

      db.run(
        "UPDATE widgets SET x = ?, y = ?, width = ?, height = ?, z_index = ? WHERE id = ?",
        [x, y, width, height, zIndex, id]
      );

      const updated = db.query("SELECT * FROM widgets WHERE id = ?").get(id);
      const settings = db.query(
        "SELECT key, value FROM widget_settings WHERE widget_id = ?"
      ).all(id);
      const settingsObj = {};
      settings.forEach(s => { settingsObj[s.key] = s.value; });

      return jsonResponse({ ...updated, settings: settingsObj });
    }

    // DELETE /api/widgets/:id - delete widget
    const widgetDeleteMatch = pathname.match(/^\/api\/widgets\/(\d+)$/);
    if (method === "DELETE" && widgetDeleteMatch) {
      const id = widgetDeleteMatch[1];
      const existing = db.query("SELECT * FROM widgets WHERE id = ?").get(id);

      if (!existing) {
        return jsonResponse({ error: "Widget not found" }, 404);
      }

      db.run("DELETE FROM widget_settings WHERE widget_id = ?", [id]);
      db.run("DELETE FROM widgets WHERE id = ?", [id]);
      return jsonResponse({ success: true });
    }

    // GET /api/widgets/:id/settings - get widget settings
    const settingsGetMatch = pathname.match(/^\/api\/widgets\/(\d+)\/settings$/);
    if (method === "GET" && settingsGetMatch) {
      const id = settingsGetMatch[1];
      const existing = db.query("SELECT * FROM widgets WHERE id = ?").get(id);

      if (!existing) {
        return jsonResponse({ error: "Widget not found" }, 404);
      }

      const settings = db.query(
        "SELECT key, value FROM widget_settings WHERE widget_id = ?"
      ).all(id);
      const settingsObj = {};
      settings.forEach(s => { settingsObj[s.key] = s.value; });

      return jsonResponse(settingsObj);
    }

    // PUT /api/widgets/:id/settings - update widget settings
    const settingsPutMatch = pathname.match(/^\/api\/widgets\/(\d+)\/settings$/);
    if (method === "PUT" && settingsPutMatch) {
      const id = settingsPutMatch[1];
      const body = await parseBody(req);
      const existing = db.query("SELECT * FROM widgets WHERE id = ?").get(id);

      if (!existing) {
        return jsonResponse({ error: "Widget not found" }, 404);
      }

      for (const [key, value] of Object.entries(body || {})) {
        db.run(
          `INSERT INTO widget_settings (widget_id, key, value) 
           VALUES (?, ?, ?) 
           ON CONFLICT(widget_id, key) DO UPDATE SET value = ?`,
          [id, key, String(value), String(value)]
        );
      }

      const settings = db.query(
        "SELECT key, value FROM widget_settings WHERE widget_id = ?"
      ).all(id);
      const settingsObj = {};
      settings.forEach(s => { settingsObj[s.key] = s.value; });

      return jsonResponse(settingsObj);
    }

    // GET /api/widgets/:id/data - proxy to fetch widget-specific data
    const dataMatch = pathname.match(/^\/api\/widgets\/(\d+)\/data$/);
    if (method === "GET" && dataMatch) {
      const id = dataMatch[1];
      const widget = db.query("SELECT * FROM widgets WHERE id = ?").get(id);

      if (!widget) {
        return jsonResponse({ error: "Widget not found" }, 404);
      }

      const settings = db.query(
        "SELECT key, value FROM widget_settings WHERE widget_id = ?"
      ).all(id);
      const settingsObj = {};
      settings.forEach(s => { settingsObj[s.key] = s.value; });

      // Route to appropriate data fetcher based on widget type
      if (widget.type === 'weather') {
        return await fetchWeatherData(settingsObj);
      } else if (widget.type === 'hackernews') {
        return await fetchHackerNewsData(settingsObj);
      }

      return jsonResponse({ error: "Unknown widget type" }, 400);
    }
  }

  // Serve static files
  return serveStatic(pathname);
}

/**
 * Fetches weather data from Open-Meteo API
 */
async function fetchWeatherData(settings) {
  try {
    const lat = settings.latitude || '40.7128';
    const lon = settings.longitude || '-74.0060';
    const units = settings.units || 'celsius';

    const tempUnit = units === 'fahrenheit' ? 'fahrenheit' : 'celsius';
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=${tempUnit}&timezone=auto&forecast_days=5`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      return jsonResponse({ error: "Failed to fetch weather data" }, 502);
    }

    const data = await response.json();
    return jsonResponse(data);
  } catch (error) {
    return jsonResponse({ error: "Weather service unavailable" }, 503);
  }
}

/**
 * Fetches top stories from HackerNews API
 */
async function fetchHackerNewsData(settings) {
  try {
    const count = Math.min(Math.max(parseInt(settings.count) || 10, 5), 25);

    const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!topStoriesRes.ok) {
      return jsonResponse({ error: "Failed to fetch HackerNews stories" }, 502);
    }

    const topStoryIds = await topStoriesRes.json();
    const storyIds = topStoryIds.slice(0, count);

    const stories = await Promise.all(
      storyIds.map(async (id) => {
        const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        return storyRes.json();
      })
    );

    return jsonResponse(stories.filter(s => s !== null));
  } catch (error) {
    return jsonResponse({ error: "HackerNews service unavailable" }, 503);
  }
}

console.log(`Todo app starting in ${config.isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode...`);
console.log(`  Config: ${config.configFile}`);
console.log(`  Database: ${config.dbPath}`);
console.log(`  Server: http://${config.host}:${config.port}`);

export default {
  port: config.port,
  fetch: handler,
};
