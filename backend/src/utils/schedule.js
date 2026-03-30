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

module.exports = {
  normalizeScheduleInput
};
