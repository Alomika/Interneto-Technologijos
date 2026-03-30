const { db } = require("./database");

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

function initDatabase() {
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
}

module.exports = {
  initDatabase
};
