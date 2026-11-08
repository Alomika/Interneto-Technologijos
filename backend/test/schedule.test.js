const assert = require("node:assert/strict");
const Module = require("node:module");
const { test } = require("node:test");

let dbAllImpl = async () => [];
const helpersPath = require.resolve("../src/db/helpers");
const mockedHelpers = new Module(helpersPath);
mockedHelpers.filename = helpersPath;
mockedHelpers.loaded = true;
mockedHelpers.exports = {
  dbAll: (...args) => dbAllImpl(...args),
  dbGet: async () => null,
  dbRun: async () => null
};
require.cache[helpersPath] = mockedHelpers;

const originalLoad = Module._load;
Module._load = function loadWithNodemailerStub(request, parent, isMain) {
  if (request === "nodemailer") return {};
  return originalLoad.call(this, request, parent, isMain);
};
let getSchedule;
try {
  ({ getSchedule } = require("../src/controllers/scheduleController"));
} finally {
  Module._load = originalLoad;
}
const { getCache, setCache } = require("../src/utils/simpleCache");

function responseMock() {
  return {
    statusCode: 200,
    body: null,
    cookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    }
  };
}

function requestMock({ date = "2026-11-08", cookies = {}, missingDate = false } = {}) {
  return {
    query: missingDate ? {} : { date },
    cookies,
    user: { id: 42 }
  };
}

test("getSchedule returns 400 when date is missing", async () => {
  let databaseCalled = false;
  dbAllImpl = async () => {
    databaseCalled = true;
    return [];
  };
  const response = responseMock();

  await getSchedule(requestMock({ missingDate: true }), response);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    message: "date query parameter is required"
  });
  assert.equal(databaseCalled, false);
});

test("getSchedule returns a valid cached schedule from the cookie", async () => {
  let databaseCalled = false;
  dbAllImpl = async () => {
    databaseCalled = true;
    return [];
  };
  const schedule = [{ id: 1, title: "Cached item" }];
  const cacheKey = "schedule_42_2026-11-08";
  const request = requestMock({
    cookies: {
      [cacheKey]: JSON.stringify({
        value: schedule,
        expires: Date.now() + 60_000
      })
    }
  });
  const response = responseMock();

  await getSchedule(request, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, schedule);
  assert.equal(response.cookies.length, 0);
  assert.equal(databaseCalled, false);
});

test("getSchedule fetches from the database when the cookie has expired", async () => {
  const rows = [{ id: 2, title: "Database item" }];
  let databaseArgs;
  dbAllImpl = async (...args) => {
    databaseArgs = args;
    return rows;
  };
  const cacheKey = "schedule_42_2026-11-08";
  const request = requestMock({
    cookies: {
      [cacheKey]: JSON.stringify({ value: [], expires: Date.now() - 1 })
    }
  });
  const response = responseMock();

  await getSchedule(request, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, rows);
  assert.deepEqual(databaseArgs[1], [42, "2026-11-08"]);
  assert.equal(response.cookies.length, 1);
  assert.equal(response.cookies[0].name, cacheKey);
  const cachedCookie = JSON.parse(response.cookies[0].value);
  assert.deepEqual(cachedCookie.value, rows);
  assert.ok(cachedCookie.expires > Date.now());
  assert.equal(response.cookies[0].options.maxAge, 60_000);
});

test("getSchedule ignores a malformed cookie and fetches from the database", async () => {
  const rows = [{ id: 3, title: "Recovered item" }];
  let databaseCalled = false;
  dbAllImpl = async () => {
    databaseCalled = true;
    return rows;
  };
  const cacheKey = "schedule_42_2026-11-08";
  const request = requestMock({ cookies: { [cacheKey]: "{invalid json" } });
  const response = responseMock();

  await getSchedule(request, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, rows);
  assert.equal(databaseCalled, true);
  assert.equal(response.cookies.length, 1);
});

test("getSchedule fetches from the database and sets a cookie when no cookie exists", async () => {
  const rows = [{ id: 4, title: "Fresh item" }];
  dbAllImpl = async () => rows;
  const response = responseMock();

  await getSchedule(requestMock(), response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, rows);
  assert.equal(response.cookies.length, 1);
  assert.equal(response.cookies[0].name, "schedule_42_2026-11-08");
});

test("getSchedule returns an empty list when the database has no schedule items", async () => {
  dbAllImpl = async () => [];
  const response = responseMock();

  await getSchedule(requestMock(), response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, []);
  assert.equal(response.cookies.length, 1);
});

test("getSchedule returns 500 when the database request fails", async () => {
  dbAllImpl = async () => {
    throw new Error("database failure");
  };
  const response = responseMock();

  await getSchedule(requestMock(), response);

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: "Failed to fetch schedule" });
  assert.equal(response.cookies.length, 0);
});

test("simpleCache stores and returns a value", () => {
  const key = `schedule-test-${Date.now()}`;
  const value = { items: ["meeting"] };

  setCache(key, value);

  assert.deepEqual(getCache(key), value);
});

test("simpleCache returns null for a missing key", () => {
  assert.equal(getCache(`missing-schedule-test-${Date.now()}`), null);
});

test("simpleCache returns null after a value expires", () => {
  const key = `expired-schedule-test-${Date.now()}`;
  setCache(key, "expired", -1);

  assert.equal(getCache(key), null);
});
