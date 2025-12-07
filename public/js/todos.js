// ============ Todo Module ============
const API = '/api/todos';
const addForm = document.getElementById('addForm');
const todoInput = document.getElementById('todoInput');
const dueDateInput = document.getElementById('dueDateInput');
const priorityInput = document.getElementById('priorityInput');
const linkInput = document.getElementById('linkInput');

const columns = {
  todo: document.getElementById('columnTodo'),
  doing: document.getElementById('columnDoing'),
  done: document.getElementById('columnDone')
};

const counts = {
  todo: document.getElementById('countTodo'),
  doing: document.getElementById('countDoing'),
  done: document.getElementById('countDone')
};

let draggedCard = null;
let activeDatePicker = null;
let activePriorityPicker = null;
let activeLinkInput = null;

// ============ Date Picker Functions ============
function initDatePicker(wrapperId, inputId, onChange) {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;
  
  wrapper.dataset.inputId = inputId;
  wrapper.dataset.currentMonth = new Date().getMonth();
  wrapper.dataset.currentYear = new Date().getFullYear();
  wrapper.onChange = onChange;
  
  renderDatePicker(wrapper);
}

function renderDatePicker(wrapper) {
  const dropdown = wrapper.querySelector('.date-picker-dropdown');
  const month = parseInt(wrapper.dataset.currentMonth);
  const year = parseInt(wrapper.dataset.currentYear);
  
  dropdown.innerHTML = `
    <div class="date-picker-header">
      <div class="date-picker-nav">
        <button type="button" onclick="navigateMonth('${wrapper.id}', -1)">${icons.chevronLeft}</button>
      </div>
      <span class="date-picker-month-year">${monthNames[month]} ${year}</span>
      <div class="date-picker-nav">
        <button type="button" onclick="navigateMonth('${wrapper.id}', 1)">${icons.chevronRight}</button>
      </div>
    </div>
    <div class="date-picker-weekdays">
      ${dayNames.map(d => `<span class="date-picker-weekday">${d}</span>`).join('')}
    </div>
    <div class="date-picker-days">
      ${generateDays(wrapper, year, month)}
    </div>
    <div class="date-picker-shortcuts">
      <button type="button" class="date-picker-shortcut" onclick="selectShortcut('${wrapper.id}', 'today')">Today</button>
      <button type="button" class="date-picker-shortcut" onclick="selectShortcut('${wrapper.id}', 'tomorrow')">Tomorrow</button>
      <button type="button" class="date-picker-shortcut" onclick="selectShortcut('${wrapper.id}', 'nextWeek')">Next Week</button>
    </div>
  `;
}

function generateDays(wrapper, year, month) {
  const inputId = wrapper.dataset.inputId;
  const input = document.getElementById(inputId);
  const selectedDate = input?.value ? new Date(input.value + 'T00:00:00') : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  
  const prevMonth = new Date(year, month, 0);
  const daysInPrevMonth = prevMonth.getDate();
  
  let days = '';
  
  for (let i = startDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    days += `<button type="button" class="date-picker-day other-month" disabled>${day}</button>`;
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = formatDateValue(date);
    const isToday = date.getTime() === today.getTime();
    const isPast = date < today;
    const isSelected = selectedDate && date.getTime() === selectedDate.getTime();
    
    let classes = 'date-picker-day';
    if (isToday) classes += ' today';
    if (isPast) classes += ' past';
    if (isSelected) classes += ' selected';
    
    days += `<button type="button" class="${classes}" onclick="selectDate('${wrapper.id}', '${dateStr}')">${day}</button>`;
  }
  
  const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;
  const nextMonthDays = totalCells - startDay - daysInMonth;
  for (let day = 1; day <= nextMonthDays; day++) {
    days += `<button type="button" class="date-picker-day other-month" disabled>${day}</button>`;
  }
  
  return days;
}

function navigateMonth(wrapperId, direction) {
  const wrapper = document.getElementById(wrapperId);
  let month = parseInt(wrapper.dataset.currentMonth) + direction;
  let year = parseInt(wrapper.dataset.currentYear);
  
  if (month < 0) { month = 11; year--; }
  else if (month > 11) { month = 0; year++; }
  
  wrapper.dataset.currentMonth = month;
  wrapper.dataset.currentYear = year;
  renderDatePicker(wrapper);
}

function selectDate(wrapperId, dateStr) {
  const wrapper = document.getElementById(wrapperId);
  const inputId = wrapper.dataset.inputId;
  const input = document.getElementById(inputId);
  
  if (input) input.value = dateStr;
  updateDatePickerDisplay(wrapper, dateStr);
  closeDatePicker(wrapper);
  
  if (wrapper.onChange) wrapper.onChange(dateStr);
}

function selectShortcut(wrapperId, shortcut) {
  const today = new Date();
  let date;
  
  switch (shortcut) {
    case 'today': date = today; break;
    case 'tomorrow': date = new Date(today); date.setDate(date.getDate() + 1); break;
    case 'nextWeek': date = new Date(today); date.setDate(date.getDate() + 7); break;
  }
  
  selectDate(wrapperId, formatDateValue(date));
}

function updateDatePickerDisplay(wrapper, dateStr) {
  const trigger = wrapper.querySelector('.date-picker-trigger');
  const textEl = trigger.querySelector('.date-text');
  
  if (dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    textEl.textContent = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    textEl.classList.remove('placeholder');
    
    if (!trigger.querySelector('.clear-btn')) {
      const clearBtn = document.createElement('span');
      clearBtn.className = 'clear-btn';
      clearBtn.innerHTML = icons.close;
      clearBtn.onclick = (e) => { e.stopPropagation(); clearDate(wrapper.id); };
      trigger.appendChild(clearBtn);
    }
  } else {
    textEl.textContent = 'Due date';
    textEl.classList.add('placeholder');
    const clearBtn = trigger.querySelector('.clear-btn');
    if (clearBtn) clearBtn.remove();
  }
}

function clearDate(wrapperId) {
  const wrapper = document.getElementById(wrapperId);
  const inputId = wrapper.dataset.inputId;
  const input = document.getElementById(inputId);
  
  if (input) input.value = '';
  updateDatePickerDisplay(wrapper, '');
  if (wrapper.onChange) wrapper.onChange(null);
}

function toggleDatePicker(wrapperId) {
  const wrapper = document.getElementById(wrapperId);
  const dropdown = wrapper.querySelector('.date-picker-dropdown');
  const trigger = wrapper.querySelector('.date-picker-trigger');
  
  if (activePriorityPicker) closePriorityPicker(activePriorityPicker);
  if (activeDatePicker && activeDatePicker !== wrapper) closeDatePicker(activeDatePicker);
  
  if (dropdown.classList.contains('open')) {
    closeDatePicker(wrapper);
  } else {
    dropdown.classList.add('open');
    trigger.classList.add('active');
    activeDatePicker = wrapper;
    
    const inputId = wrapper.dataset.inputId;
    const input = document.getElementById(inputId);
    if (input?.value) {
      const date = new Date(input.value + 'T00:00:00');
      wrapper.dataset.currentMonth = date.getMonth();
      wrapper.dataset.currentYear = date.getFullYear();
    } else {
      wrapper.dataset.currentMonth = new Date().getMonth();
      wrapper.dataset.currentYear = new Date().getFullYear();
    }
    renderDatePicker(wrapper);
  }
}

function closeDatePicker(wrapper) {
  const dropdown = wrapper.querySelector('.date-picker-dropdown');
  const trigger = wrapper.querySelector('.date-picker-trigger');
  dropdown.classList.remove('open');
  trigger.classList.remove('active');
  if (activeDatePicker === wrapper) activeDatePicker = null;
}

// ============ Priority Picker Functions ============
function initPriorityPicker(wrapperId, inputId, onChange) {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;
  
  wrapper.dataset.inputId = inputId;
  wrapper.onChange = onChange;
  
  renderPriorityPicker(wrapper);
}

function renderPriorityPicker(wrapper) {
  const dropdown = wrapper.querySelector('.priority-picker-dropdown');
  const inputId = wrapper.dataset.inputId;
  const input = document.getElementById(inputId);
  const currentValue = input?.value || '';
  
  const options = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
    { value: '', label: 'None' }
  ];
  
  dropdown.innerHTML = options.map(opt => `
    <button type="button" class="priority-option ${currentValue === opt.value ? 'selected' : ''}" onclick="selectPriority('${wrapper.id}', '${opt.value}')">
      <span class="priority-dot ${opt.value || 'none'}"></span>
      <span class="priority-label">${opt.label}</span>
      <span class="check-icon">${icons.checkSmall}</span>
    </button>
  `).join('');
}

function selectPriority(wrapperId, value) {
  const wrapper = document.getElementById(wrapperId);
  const inputId = wrapper.dataset.inputId;
  const input = document.getElementById(inputId);
  
  if (input) input.value = value;
  updatePriorityPickerDisplay(wrapper, value);
  closePriorityPicker(wrapper);
  
  if (wrapper.onChange) wrapper.onChange(value);
}

function updatePriorityPickerDisplay(wrapper, value) {
  const trigger = wrapper.querySelector('.priority-picker-trigger');
  const dot = trigger.querySelector('.priority-dot');
  const textEl = trigger.querySelector('.priority-text');
  
  dot.className = `priority-dot ${value || 'none'}`;
  
  if (value) {
    textEl.textContent = priorityLabels[value];
    textEl.classList.remove('placeholder');
    
    if (!trigger.querySelector('.clear-btn')) {
      const chevron = trigger.querySelector('.chevron');
      const clearBtn = document.createElement('span');
      clearBtn.className = 'clear-btn';
      clearBtn.innerHTML = icons.close;
      clearBtn.onclick = (e) => { e.stopPropagation(); clearPriority(wrapper.id); };
      trigger.insertBefore(clearBtn, chevron);
    }
  } else {
    textEl.textContent = 'Priority';
    textEl.classList.add('placeholder');
    const clearBtn = trigger.querySelector('.clear-btn');
    if (clearBtn) clearBtn.remove();
  }
}

function clearPriority(wrapperId) {
  const wrapper = document.getElementById(wrapperId);
  const inputId = wrapper.dataset.inputId;
  const input = document.getElementById(inputId);
  
  if (input) input.value = '';
  updatePriorityPickerDisplay(wrapper, '');
  if (wrapper.onChange) wrapper.onChange(null);
}

function togglePriorityPicker(wrapperId) {
  const wrapper = document.getElementById(wrapperId);
  const dropdown = wrapper.querySelector('.priority-picker-dropdown');
  const trigger = wrapper.querySelector('.priority-picker-trigger');
  
  if (activeDatePicker) closeDatePicker(activeDatePicker);
  if (activePriorityPicker && activePriorityPicker !== wrapper) closePriorityPicker(activePriorityPicker);
  
  if (dropdown.classList.contains('open')) {
    closePriorityPicker(wrapper);
  } else {
    renderPriorityPicker(wrapper);
    dropdown.classList.add('open');
    trigger.classList.add('active');
    activePriorityPicker = wrapper;
  }
}

function closePriorityPicker(wrapper) {
  const dropdown = wrapper.querySelector('.priority-picker-dropdown');
  const trigger = wrapper.querySelector('.priority-picker-trigger');
  dropdown.classList.remove('open');
  trigger.classList.remove('active');
  if (activePriorityPicker === wrapper) activePriorityPicker = null;
}

// ============ Link Attachment Functions ============
function parseLinks(linksJson) {
  if (!linksJson) return [];
  try {
    return JSON.parse(linksJson);
  } catch {
    return [];
  }
}

function getFirstLink(linksJson) {
  const links = parseLinks(linksJson);
  return links.length > 0 ? links[0] : null;
}

function toggleLinkInput(todoId) {
  const wrapper = document.getElementById(`linkWrapper_${todoId}`);
  const inputContainer = wrapper.querySelector('.link-input-container');
  const input = wrapper.querySelector('.link-input');
  
  if (activeDatePicker) closeDatePicker(activeDatePicker);
  if (activePriorityPicker) closePriorityPicker(activePriorityPicker);
  if (activeLinkInput && activeLinkInput !== wrapper) closeLinkInput(activeLinkInput);
  
  if (inputContainer.classList.contains('open')) {
    closeLinkInput(wrapper);
  } else {
    inputContainer.classList.add('open');
    wrapper.querySelector('.link-trigger').classList.add('active');
    activeLinkInput = wrapper;
    input.focus();
    input.select();
  }
}

function closeLinkInput(wrapper) {
  const inputContainer = wrapper.querySelector('.link-input-container');
  const trigger = wrapper.querySelector('.link-trigger');
  inputContainer.classList.remove('open');
  trigger.classList.remove('active');
  if (activeLinkInput === wrapper) activeLinkInput = null;
}

function saveLinkFromInput(todoId) {
  const wrapper = document.getElementById(`linkWrapper_${todoId}`);
  const input = wrapper.querySelector('.link-input');
  const url = input.value.trim();
  
  if (url && !isValidUrl(url)) {
    input.classList.add('error');
    return;
  }
  
  input.classList.remove('error');
  updateTodo(todoId, 'link', url || null);
  closeLinkInput(wrapper);
}

function clearLink(todoId, e) {
  if (e) e.stopPropagation();
  updateTodo(todoId, 'link', null);
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

function handleLinkKeydown(e, todoId) {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveLinkFromInput(todoId);
  }
  if (e.key === 'Escape') {
    const wrapper = document.getElementById(`linkWrapper_${todoId}`);
    closeLinkInput(wrapper);
  }
}

// Close pickers when clicking outside
document.addEventListener('click', (e) => {
  if (activeDatePicker && !activeDatePicker.contains(e.target)) closeDatePicker(activeDatePicker);
  if (activePriorityPicker && !activePriorityPicker.contains(e.target)) closePriorityPicker(activePriorityPicker);
  if (activeLinkInput && !activeLinkInput.contains(e.target)) closeLinkInput(activeLinkInput);
});

// ============ Todo CRUD Functions ============
async function fetchTodos() {
  const res = await fetch(API);
  return res.json();
}

function sortTodoColumn(todos) {
  return todos.sort((a, b) => {
    const aOverdue = isOverdue(a.due_date);
    const bOverdue = isOverdue(b.due_date);

    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    if (aOverdue && bOverdue) {
      return new Date(a.due_date) - new Date(b.due_date);
    }

    const aPriority = priorityOrder[a.priority] ?? 3;
    const bPriority = priorityOrder[b.priority] ?? 3;
    return aPriority - bPriority;
  });
}

function sortDoneColumn(todos) {
  return todos.sort((a, b) => {
    if (!a.completed_at && !b.completed_at) return 0;
    if (!a.completed_at) return 1;
    if (!b.completed_at) return -1;
    return new Date(b.completed_at) - new Date(a.completed_at);
  });
}

function createCard(todo, isDone = false) {
  const completedDateDisplay = isDone && todo.completed_at
    ? `<div class="card-meta"><span class="completed-date">${icons.check} Done ${formatDateTime(todo.completed_at)}</span></div>`
    : '';

  const cardOverdueClass = isOverdue(todo.due_date) && todo.status !== 'done' ? 'overdue' : '';
  const datePickerId = `datePicker_${todo.id}`;
  const priorityPickerId = `priorityPicker_${todo.id}`;
  const linkWrapperId = `linkWrapper_${todo.id}`;
  
  const currentLink = getFirstLink(todo.links);
  const hasLink = !!currentLink;

  const linkDisplay = hasLink ? `
    <div class="card-link">
      <a href="${escapeHtml(currentLink)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" title="${escapeHtml(currentLink)}">
        ${icons.externalLink}
        <span class="link-text">${escapeHtml(new URL(currentLink).hostname)}</span>
      </a>
      <button class="link-remove" onclick="clearLink(${todo.id}, event)" title="Remove link">${icons.close}</button>
    </div>
  ` : '';

  return `
    <div class="card ${cardOverdueClass}" draggable="true" data-id="${todo.id}">
      <div class="card-title" onclick="startEditTitle(${todo.id}, this)">${escapeHtml(todo.title)}</div>
      ${linkDisplay}
      ${completedDateDisplay}
      <div class="card-actions">
        <div class="date-picker-wrapper card-date-picker" id="${datePickerId}">
          <div class="date-picker-trigger" onclick="toggleDatePicker('${datePickerId}')">
            ${icons.calendar}
            <span class="date-text ${todo.due_date ? '' : 'placeholder'}">${todo.due_date ? formatDate(todo.due_date) : 'Date'}</span>
          </div>
          <div class="date-picker-dropdown"></div>
        </div>
        <input type="hidden" id="dateInput_${todo.id}" value="${todo.due_date || ''}">
        <div class="priority-picker-wrapper card-priority-picker" id="${priorityPickerId}">
          <div class="priority-picker-trigger" onclick="togglePriorityPicker('${priorityPickerId}')">
            <span class="priority-dot ${todo.priority || 'none'}"></span>
            <span class="priority-text ${todo.priority ? '' : 'placeholder'}">${todo.priority ? priorityLabels[todo.priority] : 'Priority'}</span>
            <span class="chevron">${icons.chevronDown}</span>
          </div>
          <div class="priority-picker-dropdown"></div>
        </div>
        <input type="hidden" id="priorityInput_${todo.id}" value="${todo.priority || ''}">
        <div class="link-wrapper" id="${linkWrapperId}">
          <button class="link-trigger ${hasLink ? 'has-link' : ''}" onclick="toggleLinkInput(${todo.id})" title="${hasLink ? 'Edit link' : 'Add link'}">
            ${icons.paperclip}
          </button>
          <div class="link-input-container">
            <input type="url" class="link-input" placeholder="Paste link..." value="${hasLink ? escapeHtml(currentLink) : ''}" onkeydown="handleLinkKeydown(event, ${todo.id})">
            <button class="link-save" onclick="saveLinkFromInput(${todo.id})" title="Save">${icons.checkSmall}</button>
          </div>
        </div>
        <button class="btn-delete" onclick="deleteTodo(${todo.id})" title="Delete">${icons.trash}</button>
      </div>
    </div>
  `;
}

function renderTodos(todos) {
  const grouped = {
    todo: todos.filter(t => t.status === 'todo'),
    doing: todos.filter(t => t.status === 'doing'),
    done: todos.filter(t => t.status === 'done')
  };

  grouped.todo = sortTodoColumn(grouped.todo);
  grouped.done = sortDoneColumn(grouped.done);

  for (const [status, items] of Object.entries(grouped)) {
    counts[status].textContent = items.length;
    
    if (items.length === 0) {
      columns[status].innerHTML = `<div class="empty-column">No tasks</div>`;
    } else {
      columns[status].innerHTML = items.map(todo => createCard(todo, status === 'done')).join('');
    }
  }

  // Initialize pickers for cards
  todos.forEach(todo => {
    const datePickerId = `datePicker_${todo.id}`;
    const dateInputId = `dateInput_${todo.id}`;
    const dateWrapper = document.getElementById(datePickerId);
    if (dateWrapper) {
      dateWrapper.dataset.inputId = dateInputId;
      dateWrapper.dataset.currentMonth = new Date().getMonth();
      dateWrapper.dataset.currentYear = new Date().getFullYear();
      dateWrapper.onChange = (value) => updateTodo(todo.id, 'due_date', value);
    }

    const priorityPickerId = `priorityPicker_${todo.id}`;
    const priorityInputId = `priorityInput_${todo.id}`;
    const priorityWrapper = document.getElementById(priorityPickerId);
    if (priorityWrapper) {
      priorityWrapper.dataset.inputId = priorityInputId;
      priorityWrapper.onChange = (value) => updateTodo(todo.id, 'priority', value);
    }
  });

  setupDragAndDrop();
}

function setupDragAndDrop() {
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      draggedCard = card;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      draggedCard = null;
      document.querySelectorAll('.column').forEach(col => col.classList.remove('drag-over'));
    });
  });

  document.querySelectorAll('.column').forEach(column => {
    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      column.classList.add('drag-over');
    });

    column.addEventListener('dragleave', () => {
      column.classList.remove('drag-over');
    });

    column.addEventListener('drop', (e) => {
      e.preventDefault();
      column.classList.remove('drag-over');
      
      if (draggedCard) {
        const todoId = draggedCard.dataset.id;
        const newStatus = column.dataset.status;
        moveTodo(todoId, newStatus);
      }
    });
  });
}

async function addTodo(title, dueDate, priority, link) {
  await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      title,
      due_date: dueDate || null,
      priority: priority || null,
      link: link || null,
      status: 'todo'
    })
  });
  loadTodos();
}

async function moveTodo(id, status) {
  await fetch(`${API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  loadTodos();
}

async function updateTodo(id, field, value) {
  await fetch(`${API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [field]: value || null })
  });
  loadTodos();
}

function startEditTitle(id, element) {
  const currentTitle = element.textContent;
  const card = element.closest('.card');
  card.setAttribute('draggable', 'false');
  
  const textarea = document.createElement('textarea');
  textarea.className = 'card-title-input';
  textarea.value = currentTitle;
  textarea.rows = 1;
  
  const autoResize = () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };
  
  element.replaceWith(textarea);
  textarea.focus();
  textarea.select();
  autoResize();
  
  textarea.addEventListener('input', autoResize);
  
  const saveEdit = async () => {
    const newTitle = textarea.value.trim();
    if (newTitle && newTitle !== currentTitle) {
      await updateTodo(id, 'title', newTitle);
    } else {
      const titleDiv = document.createElement('div');
      titleDiv.className = 'card-title';
      titleDiv.textContent = currentTitle;
      titleDiv.onclick = () => startEditTitle(id, titleDiv);
      textarea.replaceWith(titleDiv);
      card.setAttribute('draggable', 'true');
    }
  };
  
  textarea.addEventListener('blur', saveEdit);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      textarea.blur();
    }
    if (e.key === 'Escape') {
      textarea.value = currentTitle;
      textarea.blur();
    }
  });
}

async function deleteTodo(id) {
  await fetch(`${API}/${id}`, { method: 'DELETE' });
  loadTodos();
}

async function loadTodos() {
  const todos = await fetchTodos();
  renderTodos(todos);
}

// Form submission
addForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = todoInput.value.trim();
  if (title) {
    const link = linkInput.value.trim();
    addTodo(title, dueDateInput.value, priorityInput.value, isValidUrl(link) ? link : null);
    todoInput.value = '';
    dueDateInput.value = '';
    priorityInput.value = '';
    linkInput.value = '';
    updateDatePickerDisplay(document.getElementById('mainDatePicker'), '');
    updatePriorityPickerDisplay(document.getElementById('mainPriorityPicker'), '');
    todoInput.focus();
  }
});

// Initialize main pickers
initDatePicker('mainDatePicker', 'dueDateInput');
initPriorityPicker('mainPriorityPicker', 'priorityInput');

