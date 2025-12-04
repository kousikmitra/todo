#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Todo App Uninstaller for macOS     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo

INSTALL_DIR="$HOME/.local/share/todos"
BIN_DIR="$HOME/.local/bin"
CONFIG_DIR="$HOME/.config/todos"
DATA_DIR="$HOME/Library/Application Support/todos"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
PLIST_NAME="com.todos.app.plist"
LOGS_DIR="$HOME/Library/Logs"

# Stop service if running
echo -e "${BLUE}Stopping service if running...${NC}"
launchctl stop com.todos.app 2>/dev/null || true
launchctl unload "$LAUNCH_AGENTS/$PLIST_NAME" 2>/dev/null || true

echo -e "${YELLOW}This will remove:${NC}"
echo "  - Application: $INSTALL_DIR"
echo "  - Launcher: $BIN_DIR/todos"
echo "  - Service: $LAUNCH_AGENTS/$PLIST_NAME"
echo

read -p "Keep your data and config? (y/n) [y]: " KEEP_DATA
KEEP_DATA=${KEEP_DATA:-y}

# Remove launchd plist
if [ -f "$LAUNCH_AGENTS/$PLIST_NAME" ]; then
    echo -e "${BLUE}Removing launchd service...${NC}"
    rm -f "$LAUNCH_AGENTS/$PLIST_NAME"
    echo -e "${GREEN}✓${NC} Removed $LAUNCH_AGENTS/$PLIST_NAME"
fi

# Remove application
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${BLUE}Removing application files...${NC}"
    rm -rf "$INSTALL_DIR"
    echo -e "${GREEN}✓${NC} Removed $INSTALL_DIR"
fi

# Remove launcher
if [ -f "$BIN_DIR/todos" ]; then
    echo -e "${BLUE}Removing launcher...${NC}"
    rm -f "$BIN_DIR/todos"
    echo -e "${GREEN}✓${NC} Removed $BIN_DIR/todos"
fi

# Optionally remove data and config
if [[ "$KEEP_DATA" != "y" && "$KEEP_DATA" != "Y" ]]; then
    if [ -d "$CONFIG_DIR" ]; then
        echo -e "${BLUE}Removing config...${NC}"
        rm -rf "$CONFIG_DIR"
        echo -e "${GREEN}✓${NC} Removed $CONFIG_DIR"
    fi
    
    if [ -d "$DATA_DIR" ]; then
        echo -e "${BLUE}Removing data...${NC}"
        rm -rf "$DATA_DIR"
        echo -e "${GREEN}✓${NC} Removed $DATA_DIR"
    fi
    
    # Remove log files
    rm -f "$LOGS_DIR/todos.log" "$LOGS_DIR/todos.error.log" 2>/dev/null || true
else
    echo
    echo -e "${YELLOW}Kept your data:${NC}"
    echo "  - Config: $CONFIG_DIR"
    echo "  - Database: $DATA_DIR"
fi

echo
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Uninstallation Complete! 👋        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo
