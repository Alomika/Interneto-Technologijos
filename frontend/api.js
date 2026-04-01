const API_BASE = "http://localhost:4000/api";

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

export async function apiLogin(email, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return res.json();
}

export async function apiRegister(name, email, password) {
  const res = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });
  return res.json();
}

export async function apiGetSchedule(token, date) {
  const res = await fetch(`${API_BASE}/schedule?date=${encodeURIComponent(date)}`, {
    headers: authHeaders(token)
  });
  return res.json();
}

export async function apiCreateScheduleItem(token, data) {
  const res = await fetch(`${API_BASE}/schedule`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function apiUpdateScheduleItem(token, id, data) {
  const res = await fetch(`${API_BASE}/schedule/${id}`,