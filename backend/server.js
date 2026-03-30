const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-this";

app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, "schedule.db");
const db = new sqlite3.Database(dbPath);

function migrateScheduleTableIfNeeded() {
  db.get(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'schedule_items'",
    (err, row) => {
      if (err || !row || !row.sql) return;

      const hasLegacyUnique = /UNIQUE\s*\(\s*user_id\s*,\s*date\s*,\s*time\s*\)/i.test(row.sql);
      if (!hasLegacyUnique) return;

      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run(
          `CREATE TABLE IF NOT EXISTS schedule_items_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            start_time TEXT,
            end_time TEXT,
            title TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )`
        );
        db.run(
          `INSERT INTO schedule_items_new (id, user_id, date, time, start_time, end_time, title)
           SELECT id, user_id, date, time, start_time, end_time, title
           FROM schedule_items`
        );
        db.run("DROP TABLE schedule_items");
        db.run("ALTER TABLE schedule_items_new RENAME TO schedule_items");
        db.run("COMMIT");
      });
    }
  );
}

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS schedule_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      title TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, date, time)
    )`
  );

  db.all("PRAGMA table_info(schedule_items)", (err, columns) => {
    if (err || !columns) return;

    const hasStartTime = columns.some((column) => column.name === "start_time");
    const hasEndTime = columns.some((column) => column.name === "end_time");

    if (!hasStartTime) {
      db.run("ALTER TABLE schedule_items ADD COLUMN start_time TEXT");
    }

    if (!hasEndTime) {
      db.run("ALTER TABLE schedule_items ADD COLUMN end_time TEXT");
    }
  });

  migrateScheduleTableIfNeeded();
});

function timeToMinutes(time) {
  if (!/^\d{2}:\d{2}$/.test(time || "")) return NaN;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return NaN;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
  return (hours * 60) + minutes;
}

function normalizeScheduleInput(body) {
  const { date, title } = body;
  let { startTime, endTime, time } = body;

  if (!startTime && time) {
    startTime = time;
  }

  if (!endTime && startTime) {
    const startMinutes = timeToMinutes(startTime);
    if (Number.isNaN(startMinutes)) {
      return { error: "Invalid start time" };
    }

    const endMinutes = startMinutes + 60;
    const hours = String(Math.floor(endMinutes / 60)).padStart(2, "0");
    const mins = String(endMinutes % 60).padStart(2, "0");
    endTime = `${hours}:${mins}`;
  }

  if (!date || !title || !startTime || !endTime) {
    return { error: "date, title, startTime, and endTime are required" };
  }

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) {
    return { error: "Invalid time format, expected HH:MM" };
  }

  if (endMinutes <= startMinutes) {
    return { error: "endTime must be later than startTime" };
  }

  return {
    date,
    title,
    startTime,
    endTime
  };
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      return resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      return resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      return resolve(rows);
    });
  });
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email, and password are required" });
    }

    const existingUser = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await dbRun(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [name, email, passwordHash]
    );

    return res.status(201).json({ id: result.lastID, name, email });
  } catch (error) {
    return res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const user = await dbGet("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed" });
  }
});

app.get("/api/schedule", authMiddleware, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: "date query parameter is required" });
    }

    const rows = await dbAll(
      `SELECT id, date,
        COALESCE(start_time, time) AS startTime,
        COALESCE(end_time, TIME(time, '+1 hour')) AS endTime,
        title
      FROM schedule_items
      WHERE user_id = ? AND date = ?
      ORDER BY COALESCE(start_time, time)`,
      [req.user.id, date]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch schedule" });
  }
});

app.post("/api/schedule", authMiddleware, async (req, res) => {
  try {
    const normalized = normalizeScheduleInput(req.body);
    if (normalized.error) {
      return res.status(400).json({ message: normalized.error });
    }

    const result = await dbRun(
      `INSERT INTO schedule_items (user_id, date, time, start_time, end_time, title)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        normalized.date,
        normalized.startTime,
        normalized.startTime,
        normalized.endTime,
        normalized.title
      ]
    );

    const created = await dbGet(
      `SELECT id, date,
        COALESCE(start_time, time) AS startTime,
        COALESCE(end_time, TIME(time, '+1 hour')) AS endTime,
        title
      FROM schedule_items
      WHERE id = ?`,
      [result.lastID]
    );

    return res.status(201).json(created);
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      return res.status(409).json({ message: "Conflicting item exists at the same start time" });
    }
    return res.status(500).json({ message: "Failed to create item" });
  }
});

app.put("/api/schedule/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const normalized = normalizeScheduleInput(req.body);

    if (normalized.error) {
      return res.status(400).json({ message: normalized.error });
    }

    const result = await dbRun(
      `UPDATE schedule_items
       SET date = ?, time = ?, start_time = ?, end_time = ?, title = ?
       WHERE id = ? AND user_id = ?`,
      [
        normalized.date,
        normalized.startTime,
        normalized.startTime,
        normalized.endTime,
        normalized.title,
        id,
        req.user.id
      ]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: "Item not found" });
    }

    const updated = await dbGet(
      `SELECT id, date,
        COALESCE(start_time, time) AS startTime,
        COALESCE(end_time, TIME(time, '+1 hour')) AS endTime,
        title
      FROM schedule_items
      WHERE id = ?`,
      [id]
    );

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update item" });
  }
});

app.patch("/api/schedule/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await dbGet(
      `SELECT id, date,
        COALESCE(start_time, time) AS startTime,
        COALESCE(end_time, TIME(time, '+1 hour')) AS endTime,
        title
      FROM schedule_items
      WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );

    if (!existing) {
      return res.status(404).json({ message: "Item not found" });
    }

    const allowedFields = ["date", "title", "startTime", "endTime", "time"];
    const hasUpdatableField = allowedFields.some((field) => req.body[field] !== undefined);

    if (!hasUpdatableField) {
      return res.status(400).json({
        message: "Provide at least one field to update: date, title, startTime, endTime, or time"
      });
    }

    const merged = {
      date: req.body.date ?? existing.date,
      title: req.body.title ?? existing.title,
      startTime: req.body.startTime ?? req.body.time ?? existing.startTime,
      endTime: req.body.endTime ?? existing.endTime
    };

    const normalized = normalizeScheduleInput(merged);
    if (normalized.error) {
      return res.status(400).json({ message: normalized.error });
    }

    await dbRun(
      `UPDATE schedule_items
       SET date = ?, time = ?, start_time = ?, end_time = ?, title = ?
       WHERE id = ? AND user_id = ?`,
      [
        normalized.date,
        normalized.startTime,
        normalized.startTime,
        normalized.endTime,
        normalized.title,
        id,
        req.user.id
      ]
    );

    const updated = await dbGet(
      `SELECT id, date,
        COALESCE(start_time, time) AS startTime,
        COALESCE(end_time, TIME(time, '+1 hour')) AS endTime,
        title
      FROM schedule_items
      WHERE id = ?`,
      [id]
    );

    return res.json(updated);
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      return res.status(409).json({ message: "Conflicting item exists at the same start time" });
    }
    return res.status(500).json({ message: "Failed to patch item" });
  }
});

app.delete("/api/schedule/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbRun(
      "DELETE FROM schedule_items WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: "Item not found" });
    }

    return res.json({ message: "Deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete item" });
  }
});

app.post("/api/schedule/send-day", authMiddleware, async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ message: "date is required" });
    }

    const rows = await dbAll(
      `SELECT
        COALESCE(start_time, time) AS startTime,
        COALESCE(end_time, TIME(time, '+1 hour')) AS endTime,
        title
      FROM schedule_items
      WHERE user_id = ? AND date = ?
      ORDER BY COALESCE(start_time, time)`,
      [req.user.id, date]
    );

    const user = await dbGet("SELECT name, email FROM users WHERE id = ?", [req.user.id]);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const gmailUser = (process.env.GMAIL_USER || "").trim();
    const gmailAppPassword = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

    if (!gmailUser || !gmailAppPassword) {
      return res.status(500).json({ message: "Email settings are not configured" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword
      }
    });

    const list = rows.length
      ? rows.map((item) => `- ${item.startTime}-${item.endTime}: ${item.title}`).join("\n")
      : "No schedule items for this date.";

    const mailOptions = {
      from: gmailUser,
      to: user.email,
      subject: `Schedule for ${date}`,
      text: `Hello ${user.name},\n\nHere is your schedule for ${date}:\n\n${list}\n\nSent from your timetable app.`
    };

    await transporter.sendMail(mailOptions);

    return res.json({ message: `Schedule sent to ${user.email}` });
  } catch (error) {
    console.error("Email send error:", {
      message: error.message,
      code: error.code,
      responseCode: error.responseCode,
      response: error.response
    });
    return res.status(500).json({ message: "Failed to send email" });
  }
});

app.post("/api/email-test", authMiddleware, async (req, res) => {
  try {
    const user = await dbGet("SELECT name, email FROM users WHERE id = ?", [req.user.id]);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const gmailUser = (process.env.GMAIL_USER || "").trim();
    const gmailAppPassword = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

    if (!gmailUser || !gmailAppPassword) {
      return res.status(500).json({ message: "Email settings are not configured" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword
      }
    });

    await transporter.sendMail({
      from: gmailUser,
      to: user.email,
      subject: "SMTP test email",
      text: `Hello ${user.name},\n\nThis is a test email from your timetable app.\n\nIf you received this, Gmail SMTP is configured correctly.`
    });

    return res.json({
      message: `Test email sent to ${user.email}`,
      diagnostics: { smtp: "ok" }
    });
  } catch (error) {
    console.error("Email test error:", {
      message: error.message,
      code: error.code,
      responseCode: error.responseCode,
      response: error.response
    });

    return res.status(500).json({
      message: "Test email failed",
      diagnostics: {
        code: error.code || null,
        responseCode: error.responseCode || null,
        reason: error.response || error.message || "Unknown SMTP error"
      }
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
