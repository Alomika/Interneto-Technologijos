const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");
const dbHelpers = require("../db/helpers");

const REGISTER_FIELDS_ERROR = "name, email, and password are required";
const LOGIN_FIELDS_ERROR = "email and password are required";
const INVALID_CREDENTIALS_ERROR = "Invalid credentials";

class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function createResult(status, body) {
  return { status, body };
}

function validateRequiredFields(values, message) {
  const handlers = [
    () => {},
    () => {
      throw new AuthError(400, message);
    }
  ];
  return handlers[Number(!values.every(Boolean))]();
}

function rejectExistingUser(existingUser) {
  const handlers = [
    () => {},
    () => {
      throw new AuthError(409, "Email already registered");
    }
  ];
  return handlers[Number(Boolean(existingUser))]();
}

function rejectInvalidCredentials(user, passwordValid) {
  const handlerIndex = [0, 1, 1][
    [!user, !passwordValid].findIndex(Boolean) + 1
  ];
  const handlers = [
    () => {},
    () => {
      throw new AuthError(401, INVALID_CREDENTIALS_ERROR);
    },
    () => {
      throw new AuthError(401, INVALID_CREDENTIALS_ERROR);
    }
  ];
  return handlers[handlerIndex]();
}

function comparePassword(user, password) {
  const handlers = [
    () => Promise.resolve(false),
    () => bcrypt.compare(password, user.password_hash)
  ];
  return handlers[Number(Boolean(user))]();
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
  validateRequiredFields([name, email, password], REGISTER_FIELDS_ERROR);
  const existingUser = await findExistingUser(email);
  rejectExistingUser(existingUser);
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await saveUser(name, email, passwordHash);
  return createUserResponse(result, name, email);
}

async function loginUser({ email, password }) {
  validateRequiredFields([email, password], LOGIN_FIELDS_ERROR);
  const user = await findUserByEmail(email);
  const passwordValid = await comparePassword(user, password);
  rejectInvalidCredentials(user, passwordValid);
  return createLoginResponse(user);
}

function sendResult(res, result) {
  return res.status(result.status).json(result.body);
}

function handleAuthRequest(req, res, operation, errorMessage) {
  return operation(req.body)
    .then((result) => sendResult(res, result))
    .catch((error) => sendError(res, error, errorMessage));
}

function sendError(res, error, fallbackMessage) {
  const responses = [
    () => ({ status: 500, message: fallbackMessage }),
    () => ({ status: error.status, message: error.message })
  ];
  const { status, message } = responses[Number(Boolean(error.status))]();
  return res.status(status).json({ message });
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
