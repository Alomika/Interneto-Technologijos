const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const bcrypt = require("bcryptjs");
const { login } = require("../src/controllers/authController");
const { db } = require("../src/db/database");
const dbHelpers = require("../src/db/helpers");

const email = `login-test-${Date.now()}@example.com`;
const user = {
  id: null,
  name: "Login Test User",
  email,
  password: "correct-password"
};

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
  const passwordHash = await bcrypt.hash(user.password, 10);
  const result = await dbHelpers.dbRun(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
    [user.name, user.email, passwordHash]
  );
  user.id = result.lastID;
});

after(async () => {
  await dbHelpers.dbRun("DELETE FROM users WHERE id = ?", [user.id]);
  db.close();
});

test("login rejects a request without an email", async () => {
  const response = responseMock();

  await login({ body: { password: user.password } }, response);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    message: "email and password are required"
  });
});

test("login rejects a request without a password", async () => {
  const response = responseMock();

  await login({ body: { email: user.email } }, response);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    message: "email and password are required"
  });
});

test("login rejects an unknown email", async () => {
  const response = responseMock();

  await login({ body: { email: "missing@example.com", password: user.password } }, response);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { message: "Invalid credentials" });
});

test("login rejects an incorrect password", async () => {
  const response = responseMock();

  await login({ body: { email: user.email, password: "wrong-password" } }, response);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { message: "Invalid credentials" });
});

test("login returns a token and user details for valid credentials", async () => {
  const response = responseMock();

  await login({ body: { email: user.email, password: user.password } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(typeof response.body.token, "string");
  assert.deepEqual(response.body.user, {
    id: user.id,
    name: user.name,
    email: user.email
  });
});

test("login returns a server error when the database query fails", async () => {
  const response = responseMock();
  const originalDbGet = dbHelpers.dbGet;
  dbHelpers.dbGet = async () => {
    throw new Error("database unavailable");
  };

  try {
    await login({ body: { email: user.email, password: user.password } }, response);
  } finally {
    dbHelpers.dbGet = originalDbGet;
  }

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: "Login failed" });
});

test("login returns a server error when password comparison fails", async () => {
  const response = responseMock();
  const originalCompare = bcrypt.compare;
  bcrypt.compare = async () => {
    throw new Error("password service unavailable");
  };

  try {
    await login({ body: { email: user.email, password: user.password } }, response);
  } finally {
    bcrypt.compare = originalCompare;
  }

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: "Login failed" });
});
