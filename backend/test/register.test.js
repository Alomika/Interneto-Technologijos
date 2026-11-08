const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { register } = require("../src/controllers/authController");
const { db } = require("../src/db/database");
const dbHelpers = require("../src/db/helpers");

const email = `register-test-${Date.now()}@example.com`;
const user = {
  name: "Register Test User",
  email,
  password: "register-password"
};
let userId;

function responseMock() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

before(async () => {
  await dbHelpers.dbRun("DELETE FROM users WHERE email = ?", [user.email]);
});

after(async () => {
  await dbHelpers.dbRun("DELETE FROM users WHERE email = ?", [user.email]);
  db.close();
});

test("register rejects a request without a name", async () => {
  const response = responseMock();

  await register({ body: { email: user.email, password: user.password } }, response);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    message: "name, email, and password are required"
  });
});

test("register rejects a request without an email", async () => {
  const response = responseMock();

  await register({ body: { name: user.name, password: user.password } }, response);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    message: "name, email, and password are required"
  });
});

test("register rejects a request without a password", async () => {
  const response = responseMock();

  await register({ body: { name: user.name, email: user.email } }, response);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    message: "name, email, and password are required"
  });
});

test("register creates a user and returns its public details", async () => {
  const response = responseMock();

  await register({ body: user }, response);
  userId = response.body.id;

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body, {
    id: userId,
    name: user.name,
    email: user.email
  });

  const storedUser = await dbHelpers.dbGet(
    "SELECT name, email, password_hash FROM users WHERE id = ?",
    [userId]
  );
  assert.equal(storedUser.name, user.name);
  assert.equal(storedUser.email, user.email);
  assert.notEqual(storedUser.password_hash, user.password);
});

test("register rejects an email that is already registered", async () => {
  const response = responseMock();

  await register({ body: user }, response);

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body, { message: "Email already registered" });
});

test("register returns a server error when the database query fails", async () => {
  const response = responseMock();
  const originalDbGet = dbHelpers.dbGet;
  dbHelpers.dbGet = async () => {
    throw new Error("database unavailable");
  };

  try {
    await register({ body: user }, response);
  } finally {
    dbHelpers.dbGet = originalDbGet;
  }

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: "Registration failed" });
});

test("register returns a server error when inserting the user fails", async () => {
  const response = responseMock();
  const originalDbGet = dbHelpers.dbGet;
  const originalDbRun = dbHelpers.dbRun;
  dbHelpers.dbGet = async () => undefined;
  dbHelpers.dbRun = async () => {
    throw new Error("database unavailable");
  };

  try {
    await register({ body: user }, response);
  } finally {
    dbHelpers.dbGet = originalDbGet;
    dbHelpers.dbRun = originalDbRun;
  }

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: "Registration failed" });
});
