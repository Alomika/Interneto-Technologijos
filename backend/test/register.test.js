const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { register } = require("../src/controllers/authController");
const { db } = require("../src/db/database");
const { dbGet, dbRun } = require("../src/db/helpers");

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
  await dbRun("DELETE FROM users WHERE email = ?", [user.email]);
});

after(async () => {
  await dbRun("DELETE FROM users WHERE email = ?", [user.email]);
  db.close();
});

test("register rejects requests with missing fields", async () => {
  const response = responseMock();

  await register({ body: { email: user.email, password: user.password } }, response);

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

  const storedUser = await dbGet(
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
