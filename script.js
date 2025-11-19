/* ---------- ELEMENTS ---------- */
const taskInput = document.getElementById('task-input');
const taskDate = document.getElementById('task-date');
const taskPriority = document.getElementById('task-priority');
const taskCategory = document.getElementById('task-category');
const addTaskBtn = document.getElementById('add-task');
const taskList = document.getElementById('task-list');
const filters = document.querySelectorAll('.filter');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const clearCompletedBtn = document.getElementById('clear-completed');
const themeSelect = document.getElementById('theme-select');

/* DASHBOARD ELEMENTS */
const statTotal = document.getElementById('stat-total');
const statCompleted = document.getElementById('stat-completed');
const statDueToday = document.getElementById('stat-due-today');
const statOverdue = document.getElementById('stat-overdue');
const progressFill = document.getElementById('progress-fill');

/* DATA */
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let currentFilter = 'all';
let searchQuery = '';
let sortMode = 'default';

/* Pomodoro global */
let pomodoroInterval = null;
let activePomodoro = null; // { id:taskId } or null

/* Helper: save/load */
function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

/* ID generator */
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

/* Date helpers */
function todayISO() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}
function isOverdue(datestr) {
  if (!datestr) return false;
  return datestr < todayISO();
}
function isDueToday(datestr) {
  if (!datestr) return false;
  return datestr === todayISO();
}

/* PRIORITY weight for sorting */
const priorityWeight = { high: 2, medium: 1, low: 0 };

/* ---------- RENDER ---------- */
function renderTasks() {
  taskList.innerHTML = '';

  // build filtered array with original index
  const indexed = tasks.map((t,i)=>({task:t, index:i}));
  // filter
  const filtered = indexed.filter(({task}) => {
    const byFilter = currentFilter === 'all'
      || (currentFilter === 'active' && !task.completed)
      || (currentFilter === 'completed' && task.completed);

    const bySearch = task.text.toLowerCase().includes(searchQuery.toLowerCase());

    return byFilter && bySearch;
  });

  // sort
  if (sortMode === 'due') {
    filtered.sort((a,b)=>{
      const A = a.task.dueDate || '9999-12-31';
      const B = b.task.dueDate || '9999-12-31';
      return A.localeCompare(B);
    });
  } else if (sortMode === 'priority') {
    filtered.sort((a,b)=> priorityWeight[b.task.priority] - priorityWeight[a.task.priority]);
  } else if (sortMode === 'alpha') {
    filtered.sort((a,b)=> a.task.text.localeCompare(b.task.text));
  } else if (sortMode === 'newest') {
    filtered.sort((a,b)=> b.task.createdAt - a.task.createdAt);
  } // default preserves original order

  // render each
  filtered.forEach(({task, index: originalIndex}) => {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.draggable = true;
    li.dataset.index = originalIndex; // original index in tasks[]
    // due classes
    if (isOverdue(task.dueDate) && !task.completed) li.classList.add('overdue');
    if (isDueToday(task.dueDate) && !task.completed) li.classList.add('due-today');

    // left: checkbox + body
    const left = document.createElement('div'); left.className = 'task-left';

    const checkbox = document.createElement('button');
    checkbox.className = 'checkbox';
    checkbox.title = 'Toggle complete';
    checkbox.innerHTML = task.completed ? '✔️' : '';
    checkbox.onclick = () => { toggleComplete(originalIndex); };

    const body = document.createElement('div'); body.className = 'task-body';
    // title row
    const titleRow = document.createElement('div'); titleRow.className = 'task-title';

    const titleText = document.createElement('div');
    titleText.className = 'text' + (task.completed ? ' completed' : '');
    titleText.textContent = task.text;
    titleText.title = 'Toggle details / complete';
    titleText.onclick = () => toggleComplete(originalIndex);

    // right side small meta in title
    const titleRight = document.createElement('div'); titleRight.style.display='flex'; titleRight.style.gap='8px'; titleRight.style.alignItems='center';

    // category/priority chips
    const chipCat = document.createElement('span'); chipCat.className = 'chip'; chipCat.textContent = task.category || 'general';
    const chipPri = document.createElement('span'); chipPri.className = 'chip ' + (task.priority || 'medium'); chipPri.textContent = (task.priority || 'medium').toUpperCase();

    // meta row (due + createdAt)
    const meta = document.createElement('div'); meta.className = 'task-meta';
    const due = document.createElement('span'); due.textContent = task.dueDate ? `Due: ${task.dueDate}` : '';
    const created = document.createElement('span'); created.textContent = task.createdAt ? `Added: ${new Date(task.createdAt).toLocaleDateString()}` : '';

    meta.append(due, created);

    titleRow.append(titleText, titleRight);
    body.append(titleRow, meta);

    titleRight.append(chipCat, chipPri);

    left.append(checkbox, body);

    // right actions
    const actions = document.createElement('div'); actions.className = 'task-actions';

    // drag handle
    const dragHandle = document.createElement('button'); dragHandle.className = 'icon-btn drag-handle'; dragHandle.title='Drag to reorder'; dragHandle.innerHTML='↕';
    dragHandle.onmousedown = e => e.preventDefault(); // avoid focus

    // edit button
    const editBtn = document.createElement('button'); editBtn.className='icon-btn'; editBtn.title='Edit'; editBtn.innerHTML='✏️';
    editBtn.onclick = () => openEdit(originalIndex);

    // delete
    const delBtn = document.createElement('button'); delBtn.className='icon-btn'; delBtn.title='Delete'; delBtn.innerHTML='🗑️';
    delBtn.onclick = () => { if(confirm('Delete this task?')) deleteTask(originalIndex); };

    // details toggle
    const detailsBtn = document.createElement('button'); detailsBtn.className='icon-btn'; detailsBtn.title='Toggle details'; detailsBtn.innerHTML='Details';
    // we will set details area later; handling below

    // pomodoro button and timer display
    const pomoBtn = document.createElement('button'); pomoBtn.className='icon-btn'; pomoBtn.title='Start/Pause Pomodoro'; pomoBtn.innerHTML='⏱';
    pomoBtn.onclick = () => togglePomodoro(task.id);

    const pomoDisplay = document.createElement('div'); pomoDisplay.style.minWidth='72px'; pomoDisplay.style.fontSize='13px';
    pomoDisplay.id = 'pomo-' + task.id;
    updatePomodoroDisplay(task, pomoDisplay);

    actions.append(dragHandle, editBtn, detailsBtn, pomoBtn, pomoDisplay, delBtn);

    // details section: notes & pomodoro stats & inline edit area
    const details = document.createElement('div'); details.className='details';
    if (task.open) details.classList.add('open');

    // notes textarea
    const notes = document.createElement('textarea'); notes.placeholder = 'Notes / description...';
    notes.value = task.notes || '';
    notes.onchange = () => { task.notes = notes.value; saveTasks(); renderTasks(); };

    // save notes button
    const notesSave = document.createElement('div'); notesSave.style.marginTop='6px';
    const saveNotesBtn = document.createElement('button'); saveNotesBtn.textContent='Save notes'; saveNotesBtn.className='icon-btn';
    saveNotesBtn.onclick = () => { task.notes = notes.value; saveTasks(); renderTasks(); };

    // pomodoro stats
    const pomoStats = document.createElement('div'); pomoStats.style.marginTop='8px';
    pomoStats.innerHTML = `<small>Pomodoros completed: <strong>${task.pomodorosCompleted || 0}</strong></small>`;

    details.append(notes, notesSave);
    notesSave.append(saveNotesBtn);
    details.append(pomoStats);

    detailsBtn.onclick = () => {
      task.open = !task.open;
      saveTasks();
      renderTasks();
    };

    // put everything together
    li.append(left, actions);
    // add details as own full-row
    const wrapper = document.createElement('div');
    wrapper.style.width='100%';
    wrapper.appendChild(li);
    wrapper.appendChild(details);

    // events for drag & drop
    li.addEventListener('dragstart', e=>{
      e.dataTransfer.setData('text/plain', originalIndex);
      e.dataTransfer.effectAllowed = 'move';
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', e=>{
      li.classList.remove('dragging');
    });
    li.addEventListener('dragover', e=>{
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    li.addEventListener('drop', e=>{
      e.preventDefault();
      const fromIndex = Number(e.dataTransfer.getData('text/plain'));
      const toIndex = originalIndex;
      if (!Number.isFinite(fromIndex)) return;
      reorderTasks(fromIndex, toIndex);
    });

    // append
    taskList.appendChild(wrapper);
  });

  updateDashboard();
}

/* ---------- TASK ACTIONS ---------- */
function addTask() {
  const text = taskInput.value.trim();
  if (!text) return;
  const t = {
    id: makeId(),
    text,
    completed: false,
    dueDate: taskDate.value || null,
    priority: taskPriority.value || 'medium',
    category: taskCategory.value || 'general',
    notes: '',
    createdAt: Date.now(),
    pomodoroRemaining: null, // seconds
    pomodoroRunning: false,
    pomodorosCompleted: 0,
    open: false
  };
  tasks.push(t);
  taskInput.value = '';
  taskDate.value = '';
  saveTasks();
  renderTasks();
}

function toggleComplete(i) {
  tasks[i].completed = !tasks[i].completed;
  saveTasks();
  renderTasks();
}

function deleteTask(i) {
  tasks.splice(i,1);
  saveTasks();
  renderTasks();
}

function openEdit(i) {
  const task = tasks[i];
  // simple inline modal-like prompt for title, priority, category, dueDate
  const newText = prompt('Edit task text:', task.text);
  if (newText === null) return;
  task.text = newText.trim() || task.text;
  const newDue = prompt('Due date (YYYY-MM-DD or blank):', task.dueDate || '');
  if (newDue !== null) task.dueDate = newDue.trim() || null;
  const newPriority = prompt('Priority (low, medium, high):', task.priority || 'medium');
  if (newPriority !== null && ['low','medium','high'].includes(newPriority.trim())) task.priority = newPriority.trim();
  const newCat = prompt('Category:', task.category || 'general');
  if (newCat !== null) task.category = newCat.trim() || 'general';
  saveTasks();
  renderTasks();
}

/* reorder function (drag & drop) */
function reorderTasks(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  const [item] = tasks.splice(fromIndex,1);
  tasks.splice(toIndex,0,item);
  saveTasks();
  renderTasks();
}

/* clear completed */
function clearCompleted() {
  if (!confirm('Clear all completed tasks?')) return;
  tasks = tasks.filter(t => !t.completed);
  saveTasks();
  renderTasks();
}

/* ---------- SORT / FILTER / SEARCH ---------- */
addTaskBtn.addEventListener('click', addTask);
taskInput.addEventListener('keypress', e=> { if (e.key === 'Enter') addTask(); });

filters.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    filters.forEach(f=>f.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

searchInput.addEventListener('input', e=>{
  searchQuery = e.target.value;
  renderTasks();
});

sortSelect.addEventListener('change', e=>{
  sortMode = e.target.value;
  renderTasks();
});

clearCompletedBtn.addEventListener('click', clearCompleted);

/* ---------- POMODORO IMPLEMENTATION ---------- */
/* Each task can start/pause. Only one active pomodoro runs at a time. */

function togglePomodoro(taskId) {
  const idx = tasks.findIndex(t=> t.id === taskId);
  if (idx === -1) return;
  const task = tasks[idx];

  // if another is running, stop it first
  if (activePomodoro && activePomodoro !== taskId) {
    stopActivePomodoro();
  }

  if (task.pomodoroRunning) {
    // pause
    task.pomodoroRunning = false;
    activePomodoro = null;
    stopInterval();
  } else {
    // start. if no remaining, set 25 min
    if (!task.pomodoroRemaining || task.pomodoroRemaining <= 0) {
      task.pomodoroRemaining = 25 * 60;
    }
    task.pomodoroRunning = true;
    activePomodoro = taskId;
    startInterval();
  }
  saveTasks();
  renderTasks();
}

function startInterval() {
  if (pomodoroInterval) return;
  pomodoroInterval = setInterval(()=>{
    if (!activePomodoro) { stopInterval(); return; }
    const idx = tasks.findIndex(t=> t.id === activePomodoro);
    if (idx === -1) { stopActivePomodoro(); return; }
    const t = tasks[idx];
    if (!t.pomodoroRunning) { stopActivePomodoro(); return; }
    t.pomodoroRemaining = (t.pomodoroRemaining || 0) - 1;
    if (t.pomodoroRemaining <= 0) {
      // finished
      t.pomodoroRunning = false;
      t.pomodoroRemaining = 0;
      t.pomodorosCompleted = (t.pomodorosCompleted || 0) + 1;
      // simple browser notification if allowed
      if (Notification && Notification.permission === 'granted') {
        try { new Notification('Pomodoro finished', { body: t.text }); } catch(e) {}
      }
      activePomodoro = null;
      stopInterval();
    }
    saveTasks();
    // only update displayed timer for better perf
    updateAllPomodoroDisplays();
    // also update dashboard occasionally
    updateDashboard();
  }, 1000);
}

function stopInterval() {
  if (pomodoroInterval) { clearInterval(pomodoroInterval); pomodoroInterval = null; }
}

function stopActivePomodoro() {
  const idx = tasks.findIndex(t=> t.id === activePomodoro);
  if (idx !== -1) {
    tasks[idx].pomodoroRunning = false;
  }
  activePomodoro = null;
  stopInterval();
  saveTasks();
  renderTasks();
}

function formatTime(s) {
  if (s == null) return '25:00';
  const mm = Math.floor(s / 60).toString().padStart(2,'0');
  const ss = Math.floor(s % 60).toString().padStart(2,'0');
  return `${mm}:${ss}`;
}

function updatePomodoroDisplay(task, element) {
  element.textContent = formatTime(task.pomodoroRemaining) + (task.pomodoroRunning ? ' ▶' : '');
}

function updateAllPomodoroDisplays() {
  tasks.forEach(t=>{
    const el = document.getElementById('pomo-' + t.id);
    if (el) updatePomodoroDisplay(t, el);
  });
}

/* ---------- DASHBOARD ---------- */
function updateDashboard() {
  const total = tasks.length;
  const completed = tasks.filter(t=>t.completed).length;
  const dueToday = tasks.filter(t=>isDueToday(t.dueDate) && !t.completed).length;
  const overdue = tasks.filter(t=>isOverdue(t.dueDate) && !t.completed).length;
  statTotal.textContent = total;
  statCompleted.textContent = completed;
  statDueToday.textContent = dueToday;
  statOverdue.textContent = overdue;
  const percent = total === 0 ? 0 : Math.round((completed/total)*100);
  progressFill.style.width = percent + '%';
}

/* ---------- THEME ---------- */
function applyTheme(name) {
  document.body.className = ''; // clear
  if (!name || name === 'light') {
    // default root variables already set
  } else {
    document.body.classList.add('theme-' + name);
  }
  localStorage.setItem('theme', name);
  themeSelect.value = name;
}

themeSelect.addEventListener('change', e=>{
  applyTheme(e.target.value);
});

/* ---------- INIT ---------- */
(function init(){
  // load tasks if none exist -> keep current tasks
  if (!Array.isArray(tasks)) tasks = [];

  // ensure old tasks have ids/createdAt
  let mutated = false;
  tasks.forEach(t=>{
    if (!t.id) { t.id = makeId(); mutated = true; }
    if (!t.createdAt) { t.createdAt = Date.now(); mutated = true; }
    if (t.pomodorosCompleted == null) t.pomodorosCompleted = 0;
  });
  if (mutated) saveTasks();

  // theme
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);

  // request notification permission (safe prompt)
  if ('Notification' in window && Notification.permission === 'default') {
    try { Notification.requestPermission(); } catch(e) {}
  }

  // restore pomodoro interval if one was running (resume paused state)
  // We'll not resume automatically running timers across sessions to avoid surprises.
  renderTasks();
})();
