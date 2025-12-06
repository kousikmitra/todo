import db from "../db.js";
import { parseBody, jsonResponse } from "../utils.js";

/**
 * Geocodes a location name to coordinates using Open-Meteo Geocoding API
 */
async function geocodeLocation(locationName) {
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) return null;

    const geoData = await geoRes.json();
    if (geoData.results?.[0]) {
      return {
        latitude: geoData.results[0].latitude,
        longitude: geoData.results[0].longitude
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetches weather data from Open-Meteo API
 */
async function fetchWeatherData(settings) {
  try {
    let lat, lon;
    const units = settings.units || 'celsius';

    // Prioritize location name over stored coordinates
    if (settings.location) {
      const coords = await geocodeLocation(settings.location);
      if (!coords) {
        return jsonResponse({ error: `Could not find location: ${settings.location}` }, 404);
      }
      lat = coords.latitude;
      lon = coords.longitude;
    } else if (settings.latitude && settings.longitude) {
      // Fall back to stored coordinates only if no location name is provided
      lat = settings.latitude;
      lon = settings.longitude;
    } else {
      // Default to New York if nothing is provided
      lat = '40.7128';
      lon = '-74.0060';
    }

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

/**
 * Helper function to get widget settings as an object
 */
function getWidgetSettings(widgetId) {
  const settings = db.query(
    "SELECT key, value FROM widget_settings WHERE widget_id = ?"
  ).all(widgetId);
  const settingsObj = {};
  settings.forEach(s => { settingsObj[s.key] = s.value; });
  return settingsObj;
}

/**
 * Handles all widget-related API routes
 */
export async function handleWidgetsRoutes(req, pathname, method) {
  // GET /api/widgets - list all widgets with settings
  if (method === "GET" && pathname === "/api/widgets") {
    const widgets = db.query("SELECT * FROM widgets ORDER BY z_index ASC").all();
    const widgetsWithSettings = widgets.map(widget => ({
      ...widget,
      settings: getWidgetSettings(widget.id)
    }));
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
    return jsonResponse({ ...updated, settings: getWidgetSettings(id) });
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

    return jsonResponse(getWidgetSettings(id));
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

    // If location is being updated, clear old coordinates to force re-geocoding
    if (body.location !== undefined && existing.type === 'weather') {
      db.run("DELETE FROM widget_settings WHERE widget_id = ? AND key IN ('latitude', 'longitude')", [id]);
    }

    for (const [key, value] of Object.entries(body || {})) {
      db.run(
        `INSERT INTO widget_settings (widget_id, key, value) 
         VALUES (?, ?, ?) 
         ON CONFLICT(widget_id, key) DO UPDATE SET value = ?`,
        [id, key, String(value), String(value)]
      );
    }

    return jsonResponse(getWidgetSettings(id));
  }

  // GET /api/widgets/:id/data - proxy to fetch widget-specific data
  const dataMatch = pathname.match(/^\/api\/widgets\/(\d+)\/data$/);
  if (method === "GET" && dataMatch) {
    const id = dataMatch[1];
    const widget = db.query("SELECT * FROM widgets WHERE id = ?").get(id);

    if (!widget) {
      return jsonResponse({ error: "Widget not found" }, 404);
    }

    const settingsObj = getWidgetSettings(id);

    // Route to appropriate data fetcher based on widget type
    if (widget.type === 'weather') {
      return await fetchWeatherData(settingsObj);
    } else if (widget.type === 'hackernews') {
      return await fetchHackerNewsData(settingsObj);
    }

    return jsonResponse({ error: "Unknown widget type" }, 400);
  }

  return null;
}

