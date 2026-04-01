const nodemailer = require("nodemailer");
const { dbAll, dbGet, dbRun } = require("../db/helpers");
const { normalizeScheduleInput } = require("../utils/schedule");

async function getSchedule(req, res) {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: "date query parameter is required" });
    }

    // Check for cached schedule in cookies
    const cacheKey = `schedule_${req.user.id}_${date}`;
    let cached = null;
    try {
      if (req.cookies && req.cookies[cacheKey]) {
        cached = JSON.parse(req.cookies[cacheKey]);
        // Optionally, check for expiration in the cookie value
        if (cached && cached.expires > Date.now()) {
          return res.json(cached.value);
        }
      }
    } catch (e) { /* ignore parse errors */ }

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

    // Set cookie for 60 seconds
    res.cookie(cacheKey, JSON.stringify({ value: rows, expires: Date.now() + 60000 }), {
      maxAge: 60000,
      httpOnly: false, // Set to true if you want to restrict JS access
      sameSite: "lax"
    });

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch schedule" });
  }
}

async function createScheduleItem(req, res) {
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
}

async function updateScheduleItem(req, res) {
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
}

async function patchScheduleItem(req, res) {
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
}

async function deleteScheduleItem(req, res) {
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
}

async function sendDaySchedule(req, res) {
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
}

async function sendTestEmail(req, res) {
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
}

module.exports = {
  getSchedule,
  createScheduleItem,
  updateScheduleItem,
  patchScheduleItem,
  deleteScheduleItem,
  sendDaySchedule,
  sendTestEmail
};
