#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Todo App Installer for macOS       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo

# Check for bun
if ! command -v bun &> /dev/null; then
    echo -e "${RED}Error: Bun is not installed.${NC}"
    echo "Please install Bun first: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

BUN_PATH=$(which bun)
echo -e "${GREEN}✓${NC} Bun found: $BUN_PATH ($(bun --version))"

# Define paths
INSTALL_DIR="$HOME/.local/share/todos"
BIN_DIR="$HOME/.local/bin"
CONFIG_DIR="$HOME/.config/todos"
DATA_DIR="$HOME/Library/Application Support/todos"
LOGS_DIR="$HOME/Library/Logs"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
PLIST_NAME="com.todos.app.plist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${YELLOW}→${NC} Installing to: $INSTALL_DIR"
echo -e "${YELLOW}→${NC} Config dir: $CONFIG_DIR"
echo -e "${YELLOW}→${NC} Data dir: $DATA_DIR"
echo

# Create directories
echo -e "${BLUE}Creating directories...${NC}"
mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"
mkdir -p "$CONFIG_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$LOGS_DIR"
mkdir -p "$LAUNCH_AGENTS"

# Copy application files
echo -e "${BLUE}Copying application files...${NC}"
cp "$SCRIPT_DIR/server.js" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/db.js" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/config.js" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/package.json" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/public" "$INSTALL_DIR/"

# Create launcher script with service management
echo -e "${BLUE}Creating launcher script...${NC}"
cat > "$BIN_DIR/todos" << EOF
#!/bin/bash

BUN_PATH="$BUN_PATH"
APP_DIR="\$HOME/.local/share/todos"
PLIST="\$HOME/Library/LaunchAgents/$PLIST_NAME"
SERVICE_NAME="$PLIST_NAME"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_status() {
    if launchctl list | grep -q "com.todos.app"; then
        PID=\$(launchctl list | grep "com.todos.app" | awk '{print \$1}')
        if [ "\$PID" != "-" ] && [ -n "\$PID" ]; then
            echo -e "\${GREEN}●${NC} Todo app is running (PID: \$PID)"
            echo -e "  URL: ${BLUE}http://localhost:5555${NC}"
            return 0
        fi
    fi
    echo -e "\${RED}●${NC} Todo app is not running"
    return 1
}

case "\${1:-}" in
    start)
        echo -e "\${BLUE}Starting Todo app...${NC}"
        launchctl load "\$PLIST" 2>/dev/null || true
        launchctl start com.todos.app
        sleep 1
        show_status
        ;;
    stop)
        echo -e "\${BLUE}Stopping Todo app...${NC}"
        launchctl stop com.todos.app 2>/dev/null || true
        launchctl unload "\$PLIST" 2>/dev/null || true
        echo -e "\${GREEN}✓${NC} Stopped"
        ;;
    restart)
        echo -e "\${BLUE}Restarting Todo app...${NC}"
        launchctl stop com.todos.app 2>/dev/null || true
        launchctl unload "\$PLIST" 2>/dev/null || true
        sleep 1
        launchctl load "\$PLIST"
        launchctl start com.todos.app
        sleep 1
        show_status
        ;;
    status)
        show_status
        ;;
    enable)
        echo -e "\${BLUE}Enabling auto-start on login...${NC}"
        /usr/libexec/PlistBuddy -c "Set :RunAtLoad true" "\$PLIST"
        echo -e "\${GREEN}✓${NC} Todo app will start automatically on login"
        ;;
    disable)
        echo -e "\${BLUE}Disabling auto-start on login...${NC}"
        /usr/libexec/PlistBuddy -c "Set :RunAtLoad false" "\$PLIST"
        echo -e "\${GREEN}✓${NC} Auto-start disabled"
        ;;
    logs)
        echo -e "\${BLUE}=== Todo App Logs ===${NC}"
        tail -f "\$HOME/Library/Logs/todos.log" "\$HOME/Library/Logs/todos.error.log"
        ;;
    run)
        # Run in foreground (for development)
        cd "\$APP_DIR"
        exec "\$BUN_PATH" run server.js
        ;;
    "")
        # Default: start in foreground if not running, otherwise show status
        if launchctl list | grep -q "com.todos.app"; then
            PID=\$(launchctl list | grep "com.todos.app" | awk '{print \$1}')
            if [ "\$PID" != "-" ] && [ -n "\$PID" ]; then
                show_status
                exit 0
            fi
        fi
        # Start in foreground
        cd "\$APP_DIR"
        exec "\$BUN_PATH" run server.js
        ;;
    *)
        echo "Todo App - Kanban Board"
        echo
        echo "Usage: todos [command]"
        echo
        echo "Commands:"
        echo "  start     Start as background service"
        echo "  stop      Stop the service"
        echo "  restart   Restart the service"
        echo "  status    Show service status"
        echo "  enable    Enable auto-start on login"
        echo "  disable   Disable auto-start on login"
        echo "  logs      Tail the log files"
        echo "  run       Run in foreground (for development)"
        echo
        echo "Running 'todos' without arguments starts in foreground mode."
        ;;
esac
EOF

chmod +x "$BIN_DIR/todos"

# Create and install launchd plist
echo -e "${BLUE}Installing launchd service...${NC}"
cat > "$LAUNCH_AGENTS/$PLIST_NAME" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.todos.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>$BUN_PATH</string>
        <string>run</string>
        <string>server.js</string>
    </array>
    <key>RunAtLoad</key>
    <false/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/todos.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/todos.error.log</string>
    <key>WorkingDirectory</key>
    <string>$HOME/.local/share/todos</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:$HOME/.bun/bin</string>
    </dict>
</dict>
</plist>
EOF

# Create default config if it doesn't exist
if [ ! -f "$CONFIG_DIR/config.json" ]; then
    echo -e "${BLUE}Creating default configuration...${NC}"
    cat > "$CONFIG_DIR/config.json" << 'EOF'
{
  "port": 5555,
  "host": "localhost"
}
EOF
fi

# Check if ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo
    echo -e "${YELLOW}⚠ Note: $HOME/.local/bin is not in your PATH${NC}"
    echo -e "Add this to your shell profile (~/.zshrc or ~/.bashrc):"
    echo
    echo -e "  ${GREEN}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
    echo
fi

echo
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Installation Complete! 🎉          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo
echo -e "${BLUE}Usage:${NC}"
echo "  todos              Run in foreground"
echo "  todos start        Start as background service"
echo "  todos stop         Stop the service"
echo "  todos restart      Restart the service"
echo "  todos status       Check if running"
echo "  todos enable       Auto-start on login"
echo "  todos logs         View logs"
echo
echo -e "${BLUE}Quick start:${NC}"
echo "  todos start && open http://localhost:5555"
echo
echo -e "Config: ${YELLOW}$CONFIG_DIR/config.json${NC}"
echo -e "Database: ${YELLOW}$DATA_DIR/todos.db${NC}"
echo -e "Logs: ${YELLOW}$LOGS_DIR/todos.log${NC}"
echo
