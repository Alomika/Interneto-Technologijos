const API_BASE = "http://localhost:4000/api";
let token = localStorage.getItem("token") || "";
let currentUser = JSON.parse(localStorage.getItem("user") || "null");
let dayItems = [];

const authSection = document.getElementById("authSection");
const appSection = document.getElementById("appSection");
const logoutBtn = document.getElementById("logoutBtn");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const showLogin = document.getElementById("showLogin");
const showRegister = document.getElementById("showRegister");
const authMessage = document.getElementById("authMessage");
const appMessage = document.getElementById("appMessage");

const scheduleDate = document.getElementById("scheduleDate");
const scheduleBody = document.querySelector("#scheduleTable tbody");
const sendDayBtn = document.getElementById("sendDayBtn");
const itemModal = document.getElementById("itemModal");
const modalSlotLabel = document.getElementById("modalSlotLabel");
const modalTitleInput = document.getElementById("modalTitleInput");
const modalStartTime = document.getElementById("modalStartTime");
const modalEndTime = document.getElementById("modalEndTime");
const saveItemBtn = document.getElementById("saveItemBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

let editState = null;

function setMessage(element, text, type = "") {
  element.textContent = text;
  element.className = `message ${type}`;
}

function toggleAuthForm(mode) {
  if (mode === "login") {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    showLogin.classList.add("active");
    showRegister.classList.remove("active");
  } else {
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    showRegister.classList.add("active");
    showLogin.classList.remove("active");
  }
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

function timeToMinutes(time) {
  if (!/^\d{2}:\d{2}$/.test(time || "")) return NaN;
  const [hours, minutes] = time.split(":").map(Number);
  return (hours * 60) + minutes;
}

function formatHour(hour) {
  return `${hour}:00`;
}

function formatHourInput(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function hourFromTime(time) {
  if (!/^\d{1,2}:\d{2}$/.test(time || "")) return -1;
  const hour = Number(time.split(":")[0]);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return -1;
  return hour;
}

function defaultEndTime(startTime) {
  const startMinutes = timeToMinutes(startTime);
  if (Number.isNaN(startMinutes)) return "10:00";
  const endMinutes = Math.min(startMinutes + 60, (23 * 60) + 59);
  const hours = String(Math.floor(endMinutes / 60)).padStart(2, "0");
  const minutes = String(endMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function renderTable() {
  scheduleBody.innerHTML = "";
  const sortedItems = [...dayItems].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const byHour = {};

  for (let hour = 0; hour < 24; hour += 1) {
    byHour[hour] = [];
  }

  sortedItems.forEach((item) => {
    const hour = hourFromTime(item.startTime);
    if (hour >= 0 && hour <= 23) {
      byHour[hour].push(item);
    }
  });

  for (let hour = 0; hour < 24; hour += 1) {
    const tasks = byHour[hour];
    const row = document.createElement("tr");
    const tasksHtml = tasks.length
      ? `<div class="task-list">${tasks
        .map(
          (item) => `<div class="task-item" data-task-id="${item.id}"><div class="task-title">${item.title}</div><div class="task-time">${item.startTime} - ${item.endTime}</div></div>`
        )
        .join("")}</div>`
      : "<span>No tasks</span>";

    const actionsHtml = `
      <div class="action-stack">
        <button class="small secondary" data-action="add" data-hour="${hour}">Add to schedule</button>
        ${tasks.length > 0 ? `<button class="small danger" data-action="delete-all" data-hour="${hour}">Delete all</button>` : ""}
      </div>
    `;

    row.innerHTML = `
      <td class="hour-label">${formatHour(hour)}</td>
      <td>${tasksHtml}</td>
      <td>${actionsHtml}</td>
    `;

    scheduleBody.appendChild(row);
  }
}

async function fetchSchedule() {
  const date = scheduleDate.value;
  if (!date || !token) return;

  try {
    const response = await fetch(`${API_BASE}/schedule?date=${encodeURIComponent(date)}`, {
      headers: authHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Could not load schedule");
    }

    dayItems = data;
    renderTable();
    setMessage(appMessage, `Loaded ${dayItems.length} task(s) for selected date`, "success");
  } catch (error) {
    setMessage(appMessage, error.message, "error");
  }
}

async function createItem(date, startTime, endTime, title) {
  const response = await fetch(`${API_BASE}/schedule`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ date, startTime, endTime, title })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Create failed");
}

async function updateItem(id, date, startTime, endTime, title) {
  const response = await fetch(`${API_BASE}/schedule/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ date, startTime, endTime, title })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Update failed");
}

async function deleteItem(id) {
  const response = await fetch(`${API_BASE}/schedule/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Delete failed");
}

function openEditor({ date, item = null, canDelete = false }) {
  const startTime = item ? item.startTime : "09:00";
  const endTime = item ? item.endTime : defaultEndTime(startTime);

  editState = { date, itemId: item ? item.id : null };
  modalSlotLabel.textContent = date;
  modalTitleInput.value = item ? item.title : "";
  modalStartTime.value = startTime;
  modalEndTime.value = endTime;
  
  const deleteBtn = document.getElementById("deleteItemBtn");
  if (canDelete && item && item.id) {
    deleteBtn.classList.remove("hidden");
  } else {
    deleteBtn.classList.add("hidden");
  }
  
  itemModal.classList.remove("hidden");
  modalTitleInput.focus();
}

function closeEditor() {
  editState = null;
  modalTitleInput.value = "";
  modalStartTime.value = "";
  modalEndTime.value = "";
  document.getElementById("deleteItemBtn").classList.add("hidden");
  itemModal.classList.add("hidden");
}

scheduleBody.addEventListener("click", async (event) => {
  // Handle task item clicks (edit mode)
  const taskItem = event.target.closest(".task-item");
  if (taskItem) {
    const taskId = Number(taskItem.dataset.taskId);
    const current = dayItems.find((item) => item.id === taskId);
    if (current) {
      openEditor({ date: scheduleDate.value, item: current, canDelete: true });
    }
    return;
  }

  // Handle button clicks (add, delete-all)
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  const hour = Number(button.dataset.hour);
  const date = scheduleDate.value;

  if (!date) {
    setMessage(appMessage, "Select a date first", "error");
    return;
  }

  try {
    if (action === "add") {
      const startTime = formatHourInput(hour);
      const endTime = defaultEndTime(startTime);
      openEditor({ date, item: { title: "", startTime, endTime }, canDelete: false });
      return;
    }

    if (action === "delete-all") {
      const hour = Number(button.dataset.hour);
      const tasksInHour = dayItems.filter(
        (item) => hourFromTime(item.startTime) === hour && item.date === date
      );
      for (const task of tasksInHour) {
        await deleteItem(task.id);
      }
      setMessage(appMessage, `Deleted ${tasksInHour.length} item(s)`, "success");
    }

    await fetchSchedule();
  } catch (error) {
    setMessage(appMessage, error.message, "error");
  }
});

saveItemBtn.addEventListener("click", async () => {
  if (!editState) return;

  const trimmed = modalTitleInput.value.trim();
  const startTime = modalStartTime.value;
  const endTime = modalEndTime.value;

  if (!trimmed) {
    setMessage(appMessage, "Item title cannot be empty", "error");
    return;
  }

  if (!startTime || !endTime) {
    setMessage(appMessage, "Pick both start and end time", "error");
    return;
  }

  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    setMessage(appMessage, "End time must be later than start time", "error");
    return;
  }

  try {
    if (editState.itemId) {
      await updateItem(editState.itemId, editState.date, startTime, endTime, trimmed);
      setMessage(appMessage, "Item updated", "success");
    } else {
      await createItem(editState.date, startTime, endTime, trimmed);
      setMessage(appMessage, "Item created", "success");
    }

    closeEditor();
    await fetchSchedule();
  } catch (error) {
    setMessage(appMessage, error.message, "error");
  }
});

cancelEditBtn.addEventListener("click", closeEditor);

document.getElementById("deleteItemBtn").addEventListener("click", async () => {
  if (!editState || !editState.itemId) return;
  
  try {
    await deleteItem(editState.itemId);
    setMessage(appMessage, "Item deleted", "success");
    closeEditor();
    await fetchSchedule();
  } catch (error) {
    setMessage(appMessage, error.message, "error");
  }
});

modalTitleInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveItemBtn.click();
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeEditor();
  }
});

itemModal.addEventListener("click", (event) => {
  if (event.target === itemModal) {
    closeEditor();
  }
});

sendDayBtn.addEventListener("click", async () => {
  const date = scheduleDate.value;
  if (!date) {
    setMessage(appMessage, "Choose date before sending", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/schedule/send-day`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ date })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Email send failed");
    }

    setMessage(appMessage, data.message, "success");
  } catch (error) {
    setMessage(appMessage, error.message, "error");
  }
});

showLogin.addEventListener("click", () => toggleAuthForm("login"));
showRegister.addEventListener("click", () => toggleAuthForm("register"));

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;

  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Registration failed");
    }

    setMessage(authMessage, "Registration successful. Please login.", "success");
    registerForm.reset();
    toggleAuthForm("login");
  } catch (error) {
    setMessage(authMessage, error.message, "error");
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }

    token = data.token;
    currentUser = data.user;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(currentUser));

    enterApp();
  } catch (error) {
    setMessage(authMessage, error.message, "error");
  }
});

logoutBtn.addEventListener("click", () => {
  token = "";
  currentUser = null;
  dayItems = [];
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  appSection.classList.add("hidden");
  authSection.classList.remove("hidden");
  logoutBtn.classList.add("hidden");
  setMessage(authMessage, "Logged out", "success");
});

function setDefaultDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  scheduleDate.value = `${yyyy}-${mm}-${dd}`;
}

async function enterApp() {
  authSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  setMessage(authMessage, "", "");
  setMessage(appMessage, `Welcome, ${currentUser.name}`, "success");

  if (!scheduleDate.value) {
    setDefaultDate();
  }

  await fetchSchedule();
}

scheduleDate.addEventListener("change", fetchSchedule);

if (token && currentUser) {
  setDefaultDate();
  enterApp();
} else {
  setDefaultDate();
  toggleAuthForm("login");
}
