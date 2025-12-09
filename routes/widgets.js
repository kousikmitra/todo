import db from "../db.js";
import { parseBody, jsonResponse, logError } from "../utils.js";

const DEFAULT_WEATHER_REFRESH_SECONDS = 3600; // 1 hour
const DEFAULT_HACKERNEWS_REFRESH_SECONDS = 900; // 15 minutes
const DEFAULT_DEVBLOGS_REFRESH_SECONDS = 1800; // 30 minutes
const DEFAULT_GITHUB_REFRESH_SECONDS = 3600; // 1 hour
const DEVBLOGS_TOPICS_CACHE_SECONDS = 86400; // 24 hours
const DEVBLOGS_SOURCES_CACHE_SECONDS = 86400; // 24 hours

let cachedTopics = null;
let topicsCacheTime = 0;
let cachedSources = null;
let sourcesCacheTime = 0;

/**
 * Fetches available topics from DevBlogs API with caching
 */
async function fetchDevBlogsTopics() {
  const now = Math.floor(Date.now() / 1000);
  
  // Return cached topics if still valid
  if (cachedTopics && (now - topicsCacheTime) < DEVBLOGS_TOPICS_CACHE_SECONDS) {
    return cachedTopics;
  }

  try {
    const response = await fetch('https://devblogs.sh/api/topics', {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      return cachedTopics || [];
    }

    const data = await response.json();
    cachedTopics = data.topics || [];
    topicsCacheTime = now;
    return cachedTopics;
  } catch (error) {
    logError('DevBlogs topics fetch failed:', error.message);
    return cachedTopics || [];
  }
}

/**
 * Fetches available sources from DevBlogs API with caching
 */
async function fetchDevBlogsSources() {
  const now = Math.floor(Date.now() / 1000);
  
  // Return cached sources if still valid
  if (cachedSources && (now - sourcesCacheTime) < DEVBLOGS_SOURCES_CACHE_SECONDS) {
    return cachedSources;
  }

  try {
    const response = await fetch('https://devblogs.sh/api/sources', {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      return cachedSources || [];
    }

    const data = await response.json();
    cachedSources = data.sources || [];
    sourcesCacheTime = now;
    return cachedSources;
  } catch (error) {
    logError('DevBlogs sources fetch failed:', error.message);
    return cachedSources || [];
  }
}

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
 * Saves a widget setting to the database
 */
function saveSetting(widgetId, key, value) {
  db.run(
    `INSERT INTO widget_settings (widget_id, key, value) 
     VALUES (?, ?, ?) 
     ON CONFLICT(widget_id, key) DO UPDATE SET value = ?`,
    [widgetId, key, String(value), String(value)]
  );
}

/**
 * Fetches weather data from Open-Meteo API with caching
 */
async function fetchWeatherData(widgetId, settings, forceRefresh = false) {
  const refreshPeriod = parseInt(settings.refresh_period) || DEFAULT_WEATHER_REFRESH_SECONDS;
  const lastFetched = parseInt(settings.last_fetched) || 0;
  const now = Math.floor(Date.now() / 1000);

  // Check if we have valid cached data (skip if force refresh)
  if (!forceRefresh && settings.cached_data && (now - lastFetched) < refreshPeriod) {
    try {
      return jsonResponse(JSON.parse(settings.cached_data));
    } catch {
      // Invalid cached data, continue to fetch
    }
  }

  try {
    let lat, lon;
    const units = settings.units || 'celsius';

    // Use cached coordinates if available, otherwise geocode and cache
    if (settings.latitude && settings.longitude) {
      lat = settings.latitude;
      lon = settings.longitude;
    } else if (settings.location) {
      const coords = await geocodeLocation(settings.location);
      if (coords) {
        lat = coords.latitude;
        lon = coords.longitude;
        // Cache the coordinates for future requests
        saveSetting(widgetId, 'latitude', lat);
        saveSetting(widgetId, 'longitude', lon);
      } else {
        return jsonResponse({ error: `Could not find location: ${settings.location}` }, 404);
      }
    } else {
      // Default to New York
      lat = '40.7128';
      lon = '-74.0060';
    }

    const tempUnit = units === 'fahrenheit' ? 'fahrenheit' : 'celsius';
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=${tempUnit}&timezone=auto&forecast_days=5`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      // Return cached data if available, even if stale
      if (settings.cached_data) {
        try {
          return jsonResponse(JSON.parse(settings.cached_data));
        } catch { }
      }
      return jsonResponse({ error: "Failed to fetch weather data" }, 502);
    }

    const data = await response.json();

    // Cache the response
    saveSetting(widgetId, 'cached_data', JSON.stringify(data));
    saveSetting(widgetId, 'last_fetched', now);

    return jsonResponse(data);
  } catch (error) {
    logError('Weather fetch failed:', error.message);
    // Return cached data if available on error
    if (settings.cached_data) {
      try {
        return jsonResponse(JSON.parse(settings.cached_data));
      } catch { }
    }
    return jsonResponse({ error: "Weather service unavailable" }, 503);
  }
}

/**
 * Fetches top stories from HackerNews API with caching
 */
async function fetchHackerNewsData(widgetId, settings, forceRefresh = false) {
  const refreshPeriod = parseInt(settings.refresh_period) || DEFAULT_HACKERNEWS_REFRESH_SECONDS;
  const lastFetched = parseInt(settings.last_fetched) || 0;
  const now = Math.floor(Date.now() / 1000);

  // Check if we have valid cached data
  if (!forceRefresh && settings.cached_data && (now - lastFetched) < refreshPeriod) {
    try {
      return jsonResponse(JSON.parse(settings.cached_data));
    } catch {
      // Invalid cached data, continue to fetch
    }
  }

  try {
    const count = Math.min(Math.max(parseInt(settings.count) || 10, 5), 25);

    const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!topStoriesRes.ok) {
      // Return cached data if available, even if stale
      if (settings.cached_data) {
        try {
          return jsonResponse(JSON.parse(settings.cached_data));
        } catch { }
      }
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

    const data = stories.filter(s => s !== null);

    // Cache the response
    saveSetting(widgetId, 'cached_data', JSON.stringify(data));
    saveSetting(widgetId, 'last_fetched', now);

    return jsonResponse(data);
  } catch (error) {
    logError('HackerNews fetch failed:', error.message);
    // Return cached data if available on error
    if (settings.cached_data) {
      try {
        return jsonResponse(JSON.parse(settings.cached_data));
      } catch { }
    }
    return jsonResponse({ error: "HackerNews service unavailable" }, 503);
  }
}

/**
 * Fetches posts from DevBlogs.sh API with caching
 */
async function fetchDevBlogsData(widgetId, settings, forceRefresh = false) {
  const refreshPeriod = parseInt(settings.refresh_period) || DEFAULT_DEVBLOGS_REFRESH_SECONDS;
  const lastFetched = parseInt(settings.last_fetched) || 0;
  const now = Math.floor(Date.now() / 1000);

  // Check if we have valid cached data
  if (!forceRefresh && settings.cached_data && (now - lastFetched) < refreshPeriod) {
    try {
      return jsonResponse(JSON.parse(settings.cached_data));
    } catch {
      // Invalid cached data, continue to fetch
    }
  }

  try {
    const count = Math.min(Math.max(parseInt(settings.count) || 10, 5), 20);
    const topics = settings.topics || '';
    const sources = settings.sources || '';

    // Build API URL - only add filters if not empty
    let apiUrl = `https://devblogs.sh/api/posts?page=1&limit=${count}`;
    if (topics && topics !== 'all') {
      apiUrl += `&topics=${encodeURIComponent(topics)}`;
    }
    if (sources && sources !== 'all') {
      apiUrl += `&sources=${encodeURIComponent(sources)}`;
    }
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (settings.cached_data) {
        try {
          return jsonResponse(JSON.parse(settings.cached_data));
        } catch { }
      }
      return jsonResponse({ error: "Failed to fetch DevBlogs posts" }, 502);
    }

    const apiData = await response.json();
    const data = transformDevBlogsApiResponse(apiData.posts || []);

    // Cache the response
    saveSetting(widgetId, 'cached_data', JSON.stringify(data));
    saveSetting(widgetId, 'last_fetched', now);

    return jsonResponse(data);
  } catch (error) {
    logError('DevBlogs fetch failed:', error.message);
    if (settings.cached_data) {
      try {
        return jsonResponse(JSON.parse(settings.cached_data));
      } catch { }
    }
    return jsonResponse({ error: "DevBlogs service unavailable" }, 503);
  }
}

/**
 * Transforms DevBlogs API response to widget format
 */
function transformDevBlogsApiResponse(posts) {
  return posts.map(post => ({
    title: post.title,
    link: `https://devblogs.sh/posts/${post.slug}`,
    externalUrl: post.url,
    source: post.source?.name || 'DevBlogs',
    timeAgo: formatTimeAgo(post.publishedAt),
    readTime: formatReadTime(post.readTimeSec),
    description: post.description,
    topics: post.topics?.map(t => t.name) || []
  }));
}

/**
 * Formats a date to relative time string
 */
function formatTimeAgo(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
}

/**
 * Formats read time from seconds to readable string
 */
function formatReadTime(seconds) {
  if (!seconds) return '';
  const mins = Math.ceil(seconds / 60);
  return `${mins} min read`;
}


// Common paths where gh CLI might be installed
const GH_PATHS = [
  '/opt/homebrew/bin/gh',
  '/usr/local/bin/gh',
  '/usr/bin/gh',
  'gh'  // fallback to PATH
];

let ghPath = null;

/**
 * Finds the gh CLI executable path
 */
async function findGhPath() {
  if (ghPath) return ghPath;
  
  for (const path of GH_PATHS) {
    try {
      const file = Bun.file(path);
      if (await file.exists()) {
        ghPath = path;
        return ghPath;
      }
    } catch {
      // Try next path
    }
  }
  
  // Fallback to 'gh' and hope it's in PATH
  ghPath = 'gh';
  return ghPath;
}

/**
 * Executes a gh CLI command and returns parsed JSON output
 */
async function execGhCommand(args, parseJson = true) {
  const gh = await findGhPath();
  const proc = Bun.spawn([gh, ...args], {
    stdout: 'pipe',
    stderr: 'pipe'
  });

  const output = await new Response(proc.stdout).text();
  const error = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(error || `gh command failed with exit code ${exitCode}`);
  }

  if (!parseJson) {
    return output.trim();
  }

  return JSON.parse(output);
}

/**
 * Fetches GitHub PR data using gh CLI with caching
 */
async function fetchGitHubData(widgetId, settings, forceRefresh = false) {
  const refreshPeriod = parseInt(settings.refresh_period) || DEFAULT_GITHUB_REFRESH_SECONDS;
  const lastFetched = parseInt(settings.last_fetched) || 0;
  const now = Math.floor(Date.now() / 1000);

  // Check cache validity
  if (!forceRefresh && settings.cached_data && (now - lastFetched) < refreshPeriod) {
    try {
      return jsonResponse(JSON.parse(settings.cached_data));
    } catch {
      // Invalid cached data, continue to fetch
    }
  }

  try {
    // Get current user (returns plain string, not JSON)
    const username = await execGhCommand(['api', 'user', '--jq', '.login'], false);

    // Date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    // Fetch open PRs created by me
    const myOpenPRs = await execGhCommand([
      'search', 'prs',
      '--author', '@me',
      '--state', 'open',
      '--json', 'number,title,repository,url,createdAt,isDraft',
      '--limit', '100'
    ]);

    // Fetch PRs awaiting my review
    const reviewRequests = await execGhCommand([
      'search', 'prs',
      '--review-requested', '@me',
      '--state', 'open',
      '--json', 'number,title,repository,url,createdAt,author',
      '--limit', '100'
    ]);

    // Fetch PRs by me merged in last 30 days
    const mergedPRs = await execGhCommand([
      'search', 'prs',
      '--author', '@me',
      '--merged', `>=${dateStr}`,
      '--json', 'number,title,repository,url,createdAt,state',
      '--limit', '100'
    ]);

    const data = {
      username,
      myOpenPRs: Array.isArray(myOpenPRs) ? myOpenPRs : [],
      reviewRequests: Array.isArray(reviewRequests) ? reviewRequests : [],
      mergedPRs: Array.isArray(mergedPRs) ? mergedPRs : [],
      fetchedAt: new Date().toISOString()
    };

    // Cache the response
    saveSetting(widgetId, 'cached_data', JSON.stringify(data));
    saveSetting(widgetId, 'last_fetched', now);

    return jsonResponse(data);
  } catch (error) {
    logError('GitHub fetch failed:', error.message);
    // Return cached data if available on error
    if (settings.cached_data) {
      try {
        return jsonResponse(JSON.parse(settings.cached_data));
      } catch { }
    }
    return jsonResponse({ error: error.message || "GitHub CLI unavailable. Make sure 'gh' is installed and authenticated." }, 503);
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
  // GET /api/devblogs/topics - get available DevBlogs topics
  if (method === "GET" && pathname === "/api/devblogs/topics") {
    const topics = await fetchDevBlogsTopics();
    return jsonResponse(topics);
  }

  // GET /api/devblogs/sources - get available DevBlogs sources
  if (method === "GET" && pathname === "/api/devblogs/sources") {
    const sources = await fetchDevBlogsSources();
    return jsonResponse(sources);
  }

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

    // Clear cached data when relevant settings change
    if (existing.type === 'weather') {
      if (body.location !== undefined) {
        // Location changed - clear coordinates and cache
        db.run("DELETE FROM widget_settings WHERE widget_id = ? AND key IN ('latitude', 'longitude', 'cached_data', 'last_fetched')", [id]);
      } else if (body.units !== undefined) {
        // Units changed - clear cache only (keep coordinates)
        db.run("DELETE FROM widget_settings WHERE widget_id = ? AND key IN ('cached_data', 'last_fetched')", [id]);
      }
    } else if (existing.type === 'hackernews') {
      if (body.count !== undefined) {
        // Count changed - clear cache
        db.run("DELETE FROM widget_settings WHERE widget_id = ? AND key IN ('cached_data', 'last_fetched')", [id]);
      }
    } else if (existing.type === 'devblogs') {
      if (body.count !== undefined || body.topics !== undefined || body.sources !== undefined) {
        // Count, topics, or sources changed - clear cache
        db.run("DELETE FROM widget_settings WHERE widget_id = ? AND key IN ('cached_data', 'last_fetched')", [id]);
      }
    } else if (existing.type === 'github') {
      if (body.refresh_period !== undefined) {
        // Refresh period changed - clear cache
        db.run("DELETE FROM widget_settings WHERE widget_id = ? AND key IN ('cached_data', 'last_fetched')", [id]);
      }
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
  const dataMatch = pathname.match(/^\/api\/widgets\/(\d+)\/data/);
  if (method === "GET" && dataMatch) {
    const id = dataMatch[1];
    const widget = db.query("SELECT * FROM widgets WHERE id = ?").get(id);

    if (!widget) {
      return jsonResponse({ error: "Widget not found" }, 404);
    }

    // Check for force refresh query param
    const url = new URL(req.url, 'http://localhost');
    const forceRefresh = url.searchParams.get('force') === 'true';

    const settingsObj = getWidgetSettings(id);

    // Route to appropriate data fetcher based on widget type
    if (widget.type === 'weather') {
      return await fetchWeatherData(id, settingsObj, forceRefresh);
    } else if (widget.type === 'hackernews') {
      return await fetchHackerNewsData(id, settingsObj, forceRefresh);
    } else if (widget.type === 'devblogs') {
      return await fetchDevBlogsData(id, settingsObj, forceRefresh);
    } else if (widget.type === 'github') {
      return await fetchGitHubData(id, settingsObj, forceRefresh);
    }

    return jsonResponse({ error: "Unknown widget type" }, 400);
  }

  return null;
}

