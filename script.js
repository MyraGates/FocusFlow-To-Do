// Select input elements and buttons
const taskInput = document.getElementById("task-input");
const taskDate = document.getElementById("task-date");
const addTaskBtn = document.getElementById("add-task");
const taskList = document.getElementById("task-list");
const filters = document.querySelectorAll(".filter");
const searchInput = document.getElementById("search-input");
const themeToggle = document.getElementById("theme-toggle");

// Load tasks from localStorage or set to empty array
let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

// Set initial state
let currentFilter = "all";
let searchQuery = "";

// Save tasks to localStorage
function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

// Display tasks based on current filter and search
function renderTasks() {
  taskList.innerHTML = "";

  const filteredTasks = tasks.filter(task => {
    const matchesFilter =
      currentFilter === "all" ||
      (currentFilter === "active" && !task.completed) ||
      (currentFilter === "completed" && task.completed);

    const matchesSearch = task.text.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Loop through each task and add to the DOM
  filteredTasks.forEach((task, index) => {
    const li = document.createElement("li");
    li.className = "task-item";

    const textSpan = document.createElement("span");
    textSpan.textContent = task.text;
    textSpan.className = "task-text" + (task.completed ? " completed" : "");
    textSpan.onclick = () => toggleComplete(index);

    const meta = document.createElement("div");
    meta.className = "task-meta";
    meta.textContent = task.dueDate ? `Due: ${task.dueDate}` : "";

    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.className = "delete-btn";
    deleteBtn.onclick = () => deleteTask(index);

    const leftSide = document.createElement("div");
    leftSide.style.flex = "1";
    leftSide.appendChild(textSpan);
    leftSide.appendChild(meta);

    li.appendChild(leftSide);
    li.appendChild(deleteBtn);
    taskList.appendChild(li);
  });
}

// Add a new task
function addTask() {
  const text = taskInput.value.trim();
  const date = taskDate.value;

  if (text === "") return; // Prevent adding empty task

  tasks.push({ text, completed: false, dueDate: date || null });
  taskInput.value = "";
  taskDate.value = "";
  saveTasks();
  renderTasks();
}

// Toggle completion status
function toggleComplete(index) {
  tasks[index].completed = !tasks[index].completed;
  saveTasks();
  renderTasks();
}

// Delete a task
function deleteTask(index) {
  tasks.splice(index, 1);
  saveTasks();
  renderTasks();
}

// Event: Add task button click or Enter key
addTaskBtn.addEventListener("click", addTask);
taskInput.addEventListener("keypress", e => {
  if (e.key === "Enter") addTask();
});

// Event: Filter button click
filters.forEach(btn => {
  btn.addEventListener("click", () => {
    filters.forEach(f => f.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

// Event: Search input
searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value;
  renderTasks();
});

// -------- DARK MODE --------

// Apply selected theme
function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);
  themeToggle.textContent = theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
}

// Toggle theme when button is clicked
themeToggle.addEventListener("click", () => {
  const newTheme = document.body.classList.contains("dark") ? "light" : "dark";
  applyTheme(newTheme);
});

// -------- INITIAL SETUP --------

// On page load: set theme and render tasks
(function init() {
  const savedTheme = localStorage.getItem("theme") || "light";
  applyTheme(savedTheme);
  renderTasks();
})();
