function timeToMinutes(time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  const valid = [
    /^\d{2}:\d{2}$/.test(String(time)),
    Number.isInteger(hours),
    Number.isInteger(minutes),
    hours >= 0,
    hours <= 23,
    minutes >= 0,
    minutes <= 59
  ].every(Boolean);

  return {
    valid,
    value: (hours * 60) + minutes
  };
}

function formatTime(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function resolveTimes(startTime, endTime, time) {
  const resolvedStartTime = [startTime, time].find(Boolean);
  const startResult = timeToMinutes(resolvedStartTime);
  const generatedEndTime = formatTime(startResult.value + 60);
  const generatedError = {
    true: null,
    false: "Invalid start time"
  }[startResult.valid];
  const options = [
    { startTime: resolvedStartTime, endTime: generatedEndTime, error: generatedError },
    { startTime: resolvedStartTime, endTime, error: null }
  ];

  return options[Number(Boolean(endTime))];
}

function validateScheduleInput(input) {
  const requiredFieldsPresent = [
    input.date,
    input.title,
    input.startTime,
    input.endTime
  ].every(Boolean);
  const requiredError = {
    true: null,
    false: "date, title, startTime, and endTime are required"
  }[requiredFieldsPresent];
  const startResult = timeToMinutes(input.startTime);
  const endResult = timeToMinutes(input.endTime);
  const timesValid = [startResult.valid, endResult.valid].every(Boolean);
  const timeError = {
    true: null,
    false: "Invalid time format, expected HH:MM"
  }[timesValid];
  const rangeValid = endResult.value > startResult.value;
  const rangeError = {
    true: null,
    false: "endTime must be later than startTime"
  }[rangeValid];

  return [
    requiredError,
    input.error,
    timeError,
    rangeError
  ].find(Boolean);
}

function normalizeScheduleInput(body) {
  const { date, title, startTime, endTime, time } = body;
  const resolvedTimes = resolveTimes(startTime, endTime, time);
  const normalized = {
    date,
    title,
    startTime: resolvedTimes.startTime,
    endTime: resolvedTimes.endTime
  };
  const validationError = validateScheduleInput({
    ...normalized,
    error: resolvedTimes.error
  });
  const results = [
    { error: validationError },
    normalized
  ];

  return results[Number(!validationError)];
}

module.exports = {
  normalizeScheduleInput
};
