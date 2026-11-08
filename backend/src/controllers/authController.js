const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");
const dbHelpers = require("../db/helpers");

function validateRequiredFields(values, message) {
  return values.every(Boolean)
    ? null
    : { status: 400, body: { message } };
}

async function registerUser({ name, email, password }) {
  const validation = validateRequiredFields(
    [name, email, password],
    "name, email, and password are required"
  );
  if (validation) {
    return validation;
  }

  const existingUser = await dbHelpers.dbGet(
    "SELECT id FROM users WHERE email = ?",
    [email]
  );
  if (existingUser) {
    return {
      status: 409,
      body: { message: "Email already registered" }
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await dbHelpers.dbRun(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
    [name, email, passwordHash]
  );

  return {
    status: 201,
    body: { id: result.lastID, name, email }
  };
}

function handleAuthRequest(req, res, operation, errorMessage) {
  return operation(req.body)
    .then(({ status, body }) => res.status(status).json(body))
    .catch(() => res.status(500).json({ message: errorMessage }));
}

function register(req, res) {
  return handleAuthRequest(req, res, registerUser, "Registration failed");
}


async function loginUser({ email, password }) {
  const validation = validateRequiredFields(
    [email, password],
    "email and password are required"
  );
  if (validation) {
    return validation;
  }

  const user = await dbHelpers.dbGet(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );
  if (!user) {
    return {
      status: 401,
      body: { message: "Invalid credentials" }
    };
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    return {
      status: 401,
      body: { message: "Invalid credentials" }
    };
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: "2h" }
  );

  return {
    status: 200,
    body: {
      token,
      user: { id: user.id, name: user.name, email: user.email }
    }
  };
}

function login(req, res) {
  return handleAuthRequest(req, res, loginUser, "Login failed");
}

module.exports = {
  register,
  login
};
