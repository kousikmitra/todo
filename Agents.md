# Agents.md - AI Coding Assistant Context

## Project Overview

A Kanban-style todo board application with widget dashboard support. Built with **Bun runtime**, **SQLite**, and **vanilla JavaScript** frontend.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | [Bun](https://bun.sh) |
| Backend | Bun native HTTP server |
| Database | SQLite via `bun:sqlite` |
| Frontend | Vanilla JavaScript, CSS (dark theme) |
| Module System | ES Modules (`"type": "module"`) |

## Project Structure

```
todo/
├── server.js          # HTTP server entry point, static file serving
├── db.js              # SQLite database initialization and migrations
├── config.js          # Configuration loading (dev/prod paths, ports)
├── utils.js           # Shared utilities (parseBody, jsonResponse)
├── routes/
│   ├── todos.js       # Todo CRUD API handlers
│   └── widgets.js     # Widget API handlers + external data fetchers
├── public/
│   ├── index.html     # Main HTML structure
│   ├── css/
│   │   ├── common.css   # Shared styles, variables, layout
│   │   ├── todos.css    # Kanban board and todo card styles
│   │   └── widgets.css  # Widget dashboard styles
│   └── js/
│       ├── common.js    # Shared utilities, API helpers
│       ├── todos.js     # Todo board logic, drag-and-drop
│       └── widgets.js   # Widget rendering and interactions
├── install.sh         # macOS installation script (launchd service)
├── uninstall.sh       # Cleanup script
└── package.json       # Bun scripts and metadata
```

## Backend Architecture

### Entry Point (`server.js`)
- Initializes Bun HTTP server
- Routes requests to appropriate handlers
- Serves static files from `public/`

### Route Handlers (`routes/`)
- **`todos.js`**: Exports `handleTodosRoutes(req, pathname, method)` for CRUD operations
- **`widgets.js`**: Exports `handleWidgetsRoutes(req, pathname, method)` for widget management + data fetching

### Utilities (`utils.js`)
- `parseBody(req)` - Parses JSON body with error handling
- `jsonResponse(data, status)` - Returns JSON with proper headers

## Frontend Architecture

### HTML (`public/index.html`)
- Single page with sections for todos board and widgets dashboard
- Loads modular CSS and JS files

### CSS (`public/css/`)
- **`common.css`**: CSS variables, reset, layout grid, shared components
- **`todos.css`**: Kanban columns, todo cards, priority badges, date picker
- **`widgets.css`**: Widget grid, individual widget styles (weather, HN)

### JavaScript (`public/js/`)
- **`common.js`**: API utilities, shared state, DOM helpers
- **`todos.js`**: Board rendering, drag-drop, CRUD operations
- **`widgets.js`**: Widget grid, rendering, settings management

## Database Schema

### `todos` table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key, auto-increment |
| title | TEXT | Task title (required) |
| completed | INTEGER | Legacy boolean (0/1) |
| status | TEXT | `'todo'`, `'doing'`, `'done'` |
| due_date | TEXT | ISO date string or null |
| priority | TEXT | `'high'`, `'medium'`, `'low'` or null |
| completed_at | TEXT | Timestamp when moved to done |
| created_at | TEXT | Auto-set on creation |

### `widgets` table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| type | TEXT | Widget type (`'weather'`, `'hackernews'`) |
| x, y | INTEGER | Grid position |
| width, height | INTEGER | Grid size |
| z_index | INTEGER | Stacking order |

### `widget_settings` table
| Column | Type | Description |
|--------|------|-------------|
| widget_id | INTEGER | FK to widgets |
| key | TEXT | Setting name |
| value | TEXT | Setting value |
| | | UNIQUE(widget_id, key) |

## API Routes

### Todos (`routes/todos.js`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/todos` | List all todos (ordered by created_at DESC) |
| POST | `/api/todos` | Create todo (body: `{title, due_date?, priority?, status?}`) |
| PUT | `/api/todos/:id` | Update todo |
| DELETE | `/api/todos/:id` | Delete todo |

### Widgets (`routes/widgets.js`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/widgets` | List all widgets with settings |
| POST | `/api/widgets` | Create widget |
| PUT | `/api/widgets/:id` | Update position/size |
| DELETE | `/api/widgets/:id` | Delete widget |
| GET | `/api/widgets/:id/settings` | Get widget settings |
| PUT | `/api/widgets/:id/settings` | Update widget settings |
| GET | `/api/widgets/:id/data` | Fetch widget data (weather, HN) |

### Config (`server.js`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Get client-side config |

## Configuration

**Config file:** `~/.config/todos/config.json`

```json
{
  "port": 5555,
  "host": "localhost",
  "hidden": false
}
```

**Development vs Production:**
- Dev mode: port `3000`, database at `./todo.db`
- Prod mode: port from config, database at `~/Library/Application Support/todos/todos.db`

## Development Commands

```bash
bun run dev      # Start with hot reload (--watch)
bun run start    # Start in production mode
```

## Code Patterns

### Route Handler Pattern
Each route module exports a single async function that:
1. Matches pathname/method combinations
2. Returns `Response` if matched, `null` if not
3. Server tries each handler in sequence

### Database Access
- Synchronous queries via `db.query().all()` or `db.query().get()`
- Mutations via `db.run()` returning `{ lastInsertRowid }`

### Widget Data Fetching
- `fetchWeatherData(settings)` - Proxies Open-Meteo API
- `fetchHackerNewsData(settings)` - Proxies HackerNews Firebase API

## Important Notes for AI Agents

1. **Modular Backend**: Route handlers are in `routes/`, utilities in `utils.js`
2. **Modular Frontend**: CSS/JS split by feature (common, todos, widgets)
3. **Bun-specific APIs**: Uses `Bun.file()`, `bun:sqlite`, and native `fetch` in server
4. **No Express/Hono**: Raw request handling with `Request`/`Response` objects
5. **Migration pattern**: Database columns added with `try/catch` for backwards compatibility
6. **Widget data proxy**: Server proxies external API calls (Open-Meteo, HackerNews)
7. **ES Modules**: All imports use `import`/`export`, file extensions required

## External Services

| Service | Purpose | API |
|---------|---------|-----|
| Open-Meteo | Weather widget | `api.open-meteo.com` |
| HackerNews | News widget | `hacker-news.firebaseio.com` |

## File Locations (Installed)

| Type | Path |
|------|------|
| Config | `~/.config/todos/config.json` |
| Database | `~/Library/Application Support/todos/todos.db` |
| Application | `~/.local/share/todos/` |
| Logs | `~/Library/Logs/todos.log` |
| Service | `~/Library/LaunchAgents/com.todos.app.plist` |
