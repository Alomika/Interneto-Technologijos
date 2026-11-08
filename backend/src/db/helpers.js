const { db } = require("./database");

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

async function getScheduleItemById(id) {
  return await dbGet(
    `SELECT id, date,
      COALESCE(start_time, time) AS startTime,
      COALESCE(end_time, TIME(time, '+1 hour')) AS endTime,
      title
    FROM schedule_items
    WHERE id = ?`,
    [id]
  );
}

module.exports = {
  dbRun,
  dbGet,
  dbAll,
  getScheduleItemById
};
