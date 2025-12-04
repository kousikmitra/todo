# Todo App

A simple single-page todo application built with Bun, SQLite, and vanilla JavaScript.

## Requirements

- [Bun](https://bun.sh) runtime

## Setup

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Run the server
bun run start

# Or run with hot-reload for development
bun run dev
```

## Usage

Open http://localhost:3000 in your browser.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/todos` | List all todos |
| POST | `/api/todos` | Create a new todo |
| PUT | `/api/todos/:id` | Update a todo |
| DELETE | `/api/todos/:id` | Delete a todo |

## Tech Stack

- **Runtime**: Bun
- **Database**: SQLite (via bun:sqlite)
- **Frontend**: Vanilla JavaScript
- **Styling**: CSS with custom properties

