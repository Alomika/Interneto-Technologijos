const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");
const dbHelpers = require("../db/helpers");

const REGISTER_FIELDS_ERROR = "name, email, and password are required";
const LOGIN_FIELDS_ERROR = "email and password are required";
const INVALID_CREDENTIALS_ERROR = "Invalid credentials";

function createResult(status, body) {
  return { status, body };
}

function validateRequiredFields(values, message) {
  return values.every(Boolean)
    ? null
    : createResult(400, { message });
}

async function findUserByEmail(email) {
  return dbHelpers.dbGet("SELECT * FROM users WHERE email = ?", [email]);
}

async function findExistingUser(email) {
  return dbHelpers.dbGet("SELECT id FROM users WHERE email = ?", [email]);
}

async function saveUser(name, email, passwordHash) {
  return dbHelpers.dbRun(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
    [name, email, passwordHash]
  );
}

function createUserResponse(result, name, email) {
  return createResult(201, { id: result.lastID, name, email });
}

function createLoginResponse(user) {
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: "2h" }
  );

  return createResult(200, {
    token,
    user: { id: user.id, name: user.name, email: user.email }
  });
}

async function registerUser({ name, email, password }) {
  const validation = validateRequiredFields(
    [name, email, password],
    REGISTER_FIELDS_ERROR
  );
  if (validation) {
    return validation;
  }

  const existingUser = await findExistingUser(email);
  if (existingUser) {
    return createResult(409, { message: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await saveUser(name, email, passwordHash);
  return createUserResponse(result, name, email);
}

async function loginUser({ email, password }) {
  const validation = validateRequiredFields(
    [email, password],
    LOGIN_FIELDS_ERROR
  );
  if (validation) {
    return validation;
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return createResult(401, { message: INVALID_CREDENTIALS_ERROR });
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    return createResult(401, { message: INVALID_CREDENTIALS_ERROR });
  }

  return createLoginResponse(user);
}

function sendResult(res, result) {
  return res.status(result.status).json(result.body);
}

function sendServerError(res, message) {
  return res.status(500).json({ message });
}

function handleAuthRequest(req, res, operation, errorMessage) {
  return operation(req.body)
    .then((result) => sendResult(res, result))
    .catch(() => sendServerError(res, errorMessage));
}

function register(req, res) {
  return handleAuthRequest(req, res, registerUser, "Registration failed");
}

function login(req, res) {
  return handleAuthRequest(req, res, loginUser, "Login failed");
}

module.exports = {
  register,
  login
};
