// ============ Widget Module ============
const WIDGET_API = '/api/widgets';
const widgetGrid = document.getElementById('widgetGrid');
const commandPaletteOverlay = document.getElementById('commandPaletteOverlay');
const commandPaletteInput = document.getElementById('commandPaletteInput');
const commandPaletteList = document.getElementById('commandPaletteList');

let widgets = [];
let selectedPaletteIndex = 0;
let activeSettingsPopover = null;

const GRID_SIZE = 40;

// Widget type definitions
const widgetTypes = {
  weather: {
    name: 'Weather',
    description: 'Current weather and 5-day forecast',
    icon: icons.cloud,
    defaultWidth: 7,
    defaultHeight: 6,
    defaultSettings: { latitude: '40.7128', longitude: '-74.0060', location: 'New York', units: 'celsius' }
  },
  hackernews: {
    name: 'Hacker News',
    description: 'Top stories from HN',
    icon: icons.star,
    defaultWidth: 7,
    defaultHeight: 10,
    defaultSettings: { count: '10' }
  }
};

// ============ Dashboard Toggle ============
function toggleDashboard() {
  dashboardVisible = !dashboardVisible;
  if (dashboardVisible) {
    dashboardEl.classList.add('visible');
    appEl.classList.add('hidden');
    loadWidgets();
  } else {
    dashboardEl.classList.remove('visible');
    appEl.classList.remove('hidden');
  }
}

// ============ Command Palette ============
function toggleCommandPalette() {
  commandPaletteVisible = !commandPaletteVisible;
  if (commandPaletteVisible) {
    commandPaletteOverlay.classList.add('visible');
    commandPaletteInput.value = '';
    selectedPaletteIndex = 0;
    renderCommandPalette();
    setTimeout(() => commandPaletteInput.focus(), 50);
  } else {
    commandPaletteOverlay.classList.remove('visible');
  }
}

function closeCommandPalette() {
  commandPaletteVisible = false;
  commandPaletteOverlay.classList.remove('visible');
}

function renderCommandPalette(filter = '') {
  const filtered = Object.entries(widgetTypes).filter(([key, type]) =>
    type.name.toLowerCase().includes(filter.toLowerCase()) ||
    type.description.toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) {
    commandPaletteList.innerHTML = `<div class="command-palette-empty">No widgets found</div>`;
    return;
  }

  commandPaletteList.innerHTML = filtered.map(([key, type], index) => `
    <div class="command-palette-item ${index === selectedPaletteIndex ? 'selected' : ''}" data-type="${key}">
      <div class="command-palette-item-icon ${key}">${type.icon}</div>
      <div class="command-palette-item-info">
        <div class="command-palette-item-name">${type.name}</div>
        <div class="command-palette-item-desc">${type.description}</div>
      </div>
    </div>
  `).join('');

  commandPaletteList.querySelectorAll('.command-palette-item').forEach(item => {
    item.addEventListener('click', () => {
      addWidget(item.dataset.type);
      closeCommandPalette();
    });
  });
}

function updatePaletteSelection(items) {
  items.forEach((item, i) => {
    item.classList.toggle('selected', i === selectedPaletteIndex);
  });
}

commandPaletteInput.addEventListener('input', (e) => {
  selectedPaletteIndex = 0;
  renderCommandPalette(e.target.value);
});

commandPaletteInput.addEventListener('keydown', (e) => {
  const items = commandPaletteList.querySelectorAll('.command-palette-item');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedPaletteIndex = Math.min(selectedPaletteIndex + 1, items.length - 1);
    updatePaletteSelection(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedPaletteIndex = Math.max(selectedPaletteIndex - 1, 0);
    updatePaletteSelection(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const selected = items[selectedPaletteIndex];
    if (selected) {
      addWidget(selected.dataset.type);
      closeCommandPalette();
    }
  } else if (e.key === 'Escape') {
    closeCommandPalette();
  }
});

commandPaletteOverlay.addEventListener('click', (e) => {
  if (e.target === commandPaletteOverlay) {
    closeCommandPalette();
  }
});

// ============ Widget CRUD Operations ============
async function loadWidgets() {
  try {
    const res = await fetch(WIDGET_API);
    widgets = await res.json();
    renderWidgets();
  } catch (error) {
    console.error('Failed to load widgets:', error);
  }
}

async function addWidget(type) {
  const typeDef = widgetTypes[type];
  if (!typeDef) return;

  const existingPositions = widgets.map(w => ({ x: w.x, y: w.y }));
  let x = 0, y = 0;
  while (existingPositions.some(p => p.x === x && p.y === y)) {
    x++;
    if (x > 4) { x = 0; y++; }
  }

  try {
    const res = await fetch(WIDGET_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        x,
        y,
        width: typeDef.defaultWidth,
        height: typeDef.defaultHeight,
        settings: typeDef.defaultSettings
      })
    });
    const widget = await res.json();
    widgets.push(widget);
    renderWidgets();
  } catch (error) {
    console.error('Failed to add widget:', error);
  }
}

async function updateWidget(id, updates) {
  try {
    await fetch(`${WIDGET_API}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const widget = widgets.find(w => w.id === id);
    if (widget) Object.assign(widget, updates);
  } catch (error) {
    console.error('Failed to update widget:', error);
  }
}

async function updateWidgetSettings(id, settings) {
  try {
    await fetch(`${WIDGET_API}/${id}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const widget = widgets.find(w => w.id === id);
    if (widget) widget.settings = { ...widget.settings, ...settings };
    renderWidgets();
  } catch (error) {
    console.error('Failed to update widget settings:', error);
  }
}

async function deleteWidget(id) {
  try {
    await fetch(`${WIDGET_API}/${id}`, { method: 'DELETE' });
    widgets = widgets.filter(w => w.id !== id);
    renderWidgets();
  } catch (error) {
    console.error('Failed to delete widget:', error);
  }
}

async function fetchWidgetData(id) {
  try {
    const res = await fetch(`${WIDGET_API}/${id}/data`);
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch widget data:', error);
    return { error: 'Failed to load data' };
  }
}

// ============ Widget Rendering ============
function renderWidgets() {
  if (widgets.length === 0) {
    widgetGrid.innerHTML = `
      <div class="widget-empty">
        ${icons.grid}
        <div>
          <div style="font-size: 1.1rem; font-weight: 500; margin-bottom: 4px;">No widgets yet</div>
          <div style="font-size: 0.85rem;">Press <kbd style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border);">⌘</kbd> + <kbd style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border);">K</kbd> to add one</div>
        </div>
      </div>
    `;
    return;
  }

  widgetGrid.innerHTML = widgets.map(widget => createWidgetHTML(widget)).join('');

  widgets.forEach(widget => {
    setupWidgetInteractions(widget);
    loadWidgetContent(widget);
  });
}

function createWidgetHTML(widget) {
  const typeDef = widgetTypes[widget.type] || { name: 'Unknown', icon: '' };
  const left = widget.x * GRID_SIZE;
  const top = widget.y * GRID_SIZE;
  const width = widget.width * GRID_SIZE;
  const height = widget.height * GRID_SIZE;

  return `
    <div class="widget" id="widget-${widget.id}" data-id="${widget.id}" style="left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; z-index: ${widget.z_index};">
      <div class="widget-header">
        <div class="widget-title">
          <div class="widget-title-icon ${widget.type}">${typeDef.icon}</div>
          ${typeDef.name}
        </div>
        <div class="widget-actions">
          <button class="widget-action-btn settings" title="Settings">${icons.gear}</button>
          <button class="widget-action-btn close" title="Remove widget">${icons.close}</button>
        </div>
      </div>
      <div class="widget-content" id="widget-content-${widget.id}">
        <div class="widget-loading">Loading...</div>
      </div>
      <div class="widget-resize-handle"></div>
    </div>
  `;
}

function setupWidgetInteractions(widget) {
  const el = document.getElementById(`widget-${widget.id}`);
  if (!el) return;

  const header = el.querySelector('.widget-header');
  const resizeHandle = el.querySelector('.widget-resize-handle');
  const closeBtn = el.querySelector('.widget-action-btn.close');
  const settingsBtn = el.querySelector('.widget-action-btn.settings');

  // Drag functionality
  let isDragging = false;
  let dragStartX, dragStartY, widgetStartX, widgetStartY;

  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.widget-action-btn')) return;
    isDragging = true;
    el.classList.add('dragging');
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    widgetStartX = widget.x * GRID_SIZE;
    widgetStartY = widget.y * GRID_SIZE;

    const maxZ = Math.max(...widgets.map(w => w.z_index || 0)) + 1;
    el.style.zIndex = maxZ;
    widget.z_index = maxZ;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    const gridRect = widgetGrid.getBoundingClientRect();
    const widgetWidth = widget.width * GRID_SIZE;
    const maxLeft = gridRect.width - widgetWidth;
    const newLeft = Math.max(0, Math.min(maxLeft, widgetStartX + dx));
    const newTop = Math.max(0, widgetStartY + dy);
    el.style.left = newLeft + 'px';
    el.style.top = newTop + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    el.classList.remove('dragging');

    const gridRect = widgetGrid.getBoundingClientRect();
    const widgetWidth = widget.width * GRID_SIZE;
    const maxLeft = gridRect.width - widgetWidth;
    const currentLeft = parseInt(el.style.left);
    const constrainedLeft = Math.max(0, Math.min(maxLeft, currentLeft));

    const newX = Math.round(constrainedLeft / GRID_SIZE);
    const newY = Math.round(parseInt(el.style.top) / GRID_SIZE);
    el.style.left = newX * GRID_SIZE + 'px';
    el.style.top = newY * GRID_SIZE + 'px';

    if (newX !== widget.x || newY !== widget.y) {
      widget.x = newX;
      widget.y = newY;
      updateWidget(widget.id, { x: newX, y: newY, z_index: widget.z_index });
    }
  });

  // Resize functionality
  let isResizing = false;
  let resizeStartX, resizeStartY, widgetStartWidth, widgetStartHeight;

  resizeHandle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    isResizing = true;
    el.classList.add('resizing');
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    widgetStartWidth = widget.width * GRID_SIZE;
    widgetStartHeight = widget.height * GRID_SIZE;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const dx = e.clientX - resizeStartX;
    const dy = e.clientY - resizeStartY;
    const gridRect = widgetGrid.getBoundingClientRect();
    const widgetLeft = widget.x * GRID_SIZE;
    const maxWidth = gridRect.width - widgetLeft;
    const newWidth = Math.max(GRID_SIZE * 5, Math.min(maxWidth, widgetStartWidth + dx));
    const newHeight = Math.max(GRID_SIZE * 4, widgetStartHeight + dy);
    el.style.width = newWidth + 'px';
    el.style.height = newHeight + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    el.classList.remove('resizing');

    const gridRect = widgetGrid.getBoundingClientRect();
    const widgetLeft = widget.x * GRID_SIZE;
    const maxWidth = gridRect.width - widgetLeft;
    const currentWidth = parseInt(el.style.width);
    const constrainedWidth = Math.max(GRID_SIZE * 5, Math.min(maxWidth, currentWidth));

    const newWidth = Math.round(constrainedWidth / GRID_SIZE);
    const newHeight = Math.round(parseInt(el.style.height) / GRID_SIZE);
    el.style.width = newWidth * GRID_SIZE + 'px';
    el.style.height = newHeight * GRID_SIZE + 'px';

    if (newWidth !== widget.width || newHeight !== widget.height) {
      widget.width = newWidth;
      widget.height = newHeight;
      updateWidget(widget.id, { width: newWidth, height: newHeight });
    }
  });

  // Close button
  closeBtn.addEventListener('click', () => deleteWidget(widget.id));

  // Settings button
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleWidgetSettings(widget, el);
  });
}

function toggleWidgetSettings(widget, el) {
  if (activeSettingsPopover) {
    activeSettingsPopover.remove();
    activeSettingsPopover = null;
    return;
  }

  const popover = document.createElement('div');
  popover.className = 'widget-settings-popover open';
  popover.innerHTML = getWidgetSettingsHTML(widget);

  document.body.appendChild(popover);
  activeSettingsPopover = popover;

  // Position the popover near the settings button
  const settingsBtn = el.querySelector('.widget-action-btn.settings');
  const btnRect = settingsBtn.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();

  let top = btnRect.bottom + 8;
  let left = btnRect.right - popoverRect.width;

  if (top + popoverRect.height > window.innerHeight - 20) {
    top = btnRect.top - popoverRect.height - 8;
  }

  if (left < 20) {
    left = 20;
  }

  if (left + popoverRect.width > window.innerWidth - 20) {
    left = window.innerWidth - popoverRect.width - 20;
  }

  popover.style.top = top + 'px';
  popover.style.left = left + 'px';

  // Setup form handling
  const form = popover.querySelector('form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const settings = {};
      formData.forEach((value, key) => { settings[key] = value; });
      await updateWidgetSettings(widget.id, settings);
      popover.remove();
      activeSettingsPopover = null;
    });
  }

  const cancelBtn = popover.querySelector('.widget-settings-btn.secondary');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      popover.remove();
      activeSettingsPopover = null;
    });
  }

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closePopover(e) {
      if (!popover.contains(e.target) && !e.target.closest('.widget-action-btn.settings')) {
        popover.remove();
        activeSettingsPopover = null;
        document.removeEventListener('click', closePopover);
      }
    });
  }, 0);
}

function getWidgetSettingsHTML(widget) {
  if (widget.type === 'weather') {
    return `
      <div class="widget-settings-header">Weather Settings</div>
      <form class="widget-settings-body">
        <div class="widget-settings-field">
          <label class="widget-settings-label">Location</label>
          <input type="text" name="location" class="widget-settings-input" value="${widget.settings.location || 'New York'}" placeholder="City name">
        </div>
        <div class="widget-settings-field">
          <label class="widget-settings-label">Units</label>
          <select name="units" class="widget-settings-select">
            <option value="celsius" ${widget.settings.units === 'celsius' ? 'selected' : ''}>Celsius</option>
            <option value="fahrenheit" ${widget.settings.units === 'fahrenheit' ? 'selected' : ''}>Fahrenheit</option>
          </select>
        </div>
        <div class="widget-settings-actions">
          <button type="button" class="widget-settings-btn secondary">Cancel</button>
          <button type="submit" class="widget-settings-btn primary">Save</button>
        </div>
      </form>
    `;
  } else if (widget.type === 'hackernews') {
    return `
      <div class="widget-settings-header">Hacker News Settings</div>
      <form class="widget-settings-body">
        <div class="widget-settings-field">
          <label class="widget-settings-label">Number of Stories</label>
          <select name="count" class="widget-settings-select">
            ${[5, 10, 15, 20, 25].map(n => `<option value="${n}" ${widget.settings.count == n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        <div class="widget-settings-actions">
          <button type="button" class="widget-settings-btn secondary">Cancel</button>
          <button type="submit" class="widget-settings-btn primary">Save</button>
        </div>
      </form>
    `;
  }
  return '<div class="widget-settings-body">No settings available</div>';
}

async function loadWidgetContent(widget) {
  const contentEl = document.getElementById(`widget-content-${widget.id}`);
  if (!contentEl) return;

  contentEl.innerHTML = '<div class="widget-loading">Loading...</div>';

  const data = await fetchWidgetData(widget.id);

  if (data.error) {
    contentEl.innerHTML = `<div class="widget-error">${icons.alert}<span>${data.error}</span></div>`;
    return;
  }

  if (widget.type === 'weather') {
    contentEl.innerHTML = renderWeatherContent(data, widget.settings);
  } else if (widget.type === 'hackernews') {
    contentEl.innerHTML = renderHackerNewsContent(data);
  }
}

// ============ Weather Widget Content ============
function renderWeatherContent(data, settings) {
  if (!data.current) {
    return `<div class="widget-error">${icons.alert}<span>Invalid weather data</span></div>`;
  }

  const unit = settings.units === 'fahrenheit' ? '°F' : '°C';
  const weatherCode = data.current.weather_code;
  const weatherInfo = getWeatherInfo(weatherCode);
  const location = settings.location || 'Unknown';

  let html = `
    <div class="weather-current">
      <div class="weather-icon">${weatherInfo.icon}</div>
      <div>
        <div class="weather-location">${location}</div>
        <div class="weather-temp">${Math.round(data.current.temperature_2m)}${unit}</div>
        <div class="weather-condition">${weatherInfo.desc}</div>
      </div>
    </div>
    <div class="weather-details">
      💨 ${Math.round(data.current.wind_speed_10m)} km/h &nbsp;|&nbsp; 💧 ${data.current.relative_humidity_2m}%
    </div>
  `;

  if (data.daily && data.daily.time) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    html += '<div class="weather-forecast">';
    for (let i = 1; i < Math.min(data.daily.time.length, 6); i++) {
      const date = new Date(data.daily.time[i]);
      const dayName = days[date.getDay()];
      const dayWeather = getWeatherInfo(data.daily.weather_code[i]);
      html += `
        <div class="forecast-day">
          <div class="forecast-name">${dayName}</div>
          <div class="forecast-icon">${dayWeather.icon}</div>
          <div class="forecast-temps">
            <span class="forecast-high">${Math.round(data.daily.temperature_2m_max[i])}°</span>
            <span class="forecast-low">${Math.round(data.daily.temperature_2m_min[i])}°</span>
          </div>
        </div>
      `;
    }
    html += '</div>';
  }

  return html;
}

function getWeatherInfo(code) {
  const weatherCodes = {
    0: { icon: '☀️', desc: 'Clear sky' },
    1: { icon: '🌤️', desc: 'Mainly clear' },
    2: { icon: '⛅', desc: 'Partly cloudy' },
    3: { icon: '☁️', desc: 'Overcast' },
    45: { icon: '🌫️', desc: 'Foggy' },
    48: { icon: '🌫️', desc: 'Rime fog' },
    51: { icon: '🌧️', desc: 'Light drizzle' },
    53: { icon: '🌧️', desc: 'Drizzle' },
    55: { icon: '🌧️', desc: 'Dense drizzle' },
    61: { icon: '🌧️', desc: 'Light rain' },
    63: { icon: '🌧️', desc: 'Rain' },
    65: { icon: '🌧️', desc: 'Heavy rain' },
    71: { icon: '🌨️', desc: 'Light snow' },
    73: { icon: '🌨️', desc: 'Snow' },
    75: { icon: '🌨️', desc: 'Heavy snow' },
    80: { icon: '🌦️', desc: 'Rain showers' },
    81: { icon: '🌦️', desc: 'Moderate showers' },
    82: { icon: '⛈️', desc: 'Heavy showers' },
    95: { icon: '⛈️', desc: 'Thunderstorm' },
    96: { icon: '⛈️', desc: 'Thunderstorm with hail' },
    99: { icon: '⛈️', desc: 'Severe thunderstorm' }
  };
  return weatherCodes[code] || { icon: '🌡️', desc: 'Unknown' };
}

// ============ HackerNews Widget Content ============
function renderHackerNewsContent(stories) {
  if (!Array.isArray(stories) || stories.length === 0) {
    return `<div class="widget-error">${icons.alert}<span>No stories available</span></div>`;
  }

  return `
    <div class="hn-list">
      ${stories.map((story, i) => `
        <div class="hn-item">
          <div class="hn-rank">${i + 1}.</div>
          <div class="hn-content">
            <a href="https://news.ycombinator.com/item?id=${story.id}" target="_blank" rel="noopener" class="hn-title">${escapeHtml(story.title)}</a>
            <div class="hn-meta">
              <span>⬆ ${story.score || 0}</span>
              <a href="https://news.ycombinator.com/item?id=${story.id}" target="_blank" rel="noopener">💬 ${story.descendants || 0}</a>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Close settings popover on outside click
document.addEventListener('click', (e) => {
  if (activeSettingsPopover && !e.target.closest('.widget-settings-popover') && !e.target.closest('.widget-action-btn.settings')) {
    activeSettingsPopover.remove();
    activeSettingsPopover = null;
  }
});

