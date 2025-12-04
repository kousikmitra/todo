# Todo Board

A beautiful Kanban-style todo board application built with Bun, SQLite, and vanilla JavaScript.

## Features

- 📋 Kanban board with Todo, Doing, Done columns
- 🎯 Drag and drop tasks between columns
- 📅 Custom date picker for due dates
- 🔥 Priority levels (High, Medium, Low)
- ✏️ Inline title editing
- 📱 Responsive design
- 🌙 Dark theme

## Requirements

- [Bun](https://bun.sh) runtime

## Installation

```bash
./install.sh
```

This will:
- Install the app to `~/.local/share/todos/`
- Create a `todos` command in `~/.local/bin/`
- Set up launchd service for background running
- Set up config at `~/.config/todos/`
- Store database at `~/Library/Application Support/todos/`

### Add to PATH (if needed)

If `~/.local/bin` is not in your PATH, add this to `~/.zshrc`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Usage

### Service Management

```bash
todos start      # Start as background service
todos stop       # Stop the service
todos restart    # Restart the service
todos status     # Check if running

todos enable     # Enable auto-start on login
todos disable    # Disable auto-start on login

todos logs       # Tail the log files
todos run        # Run in foreground (development)
```

### Quick Start

```bash
todos start && open http://localhost:5555
```

### Running in Foreground

```bash
todos            # Runs in foreground (Ctrl+C to stop)
# or
todos run
```

## Configuration

Edit `~/.config/todos/config.json`:

```json
{
  "port": 5555,
  "host": "localhost"
}
```

## File Locations

| Type | Path |
|------|------|
| Config | `~/.config/todos/config.json` |
| Database | `~/Library/Application Support/todos/todos.db` |
| Application | `~/.local/share/todos/` |
| Launcher | `~/.local/bin/todos` |
| Logs | `~/Library/Logs/todos.log` |
| Service | `~/Library/LaunchAgents/com.todos.app.plist` |

## Uninstall

```bash
./uninstall.sh
```

You'll be prompted to keep or remove your data.

## Development

```bash
# Run from source directory
bun run dev      # With hot reload
bun run start    # Production mode
```
