# Interneto Technologijos

Project structure:
- frontend: vanilla HTML/CSS/JS app for register, login, timetable CRUD, logout, and send-day email action
- backend: Node.js + Express + SQLite API (modular structure)

Backend code layout:
- `server.js` (entrypoint)
- `src/app.js` (Express app + middleware)
- `src/routes/apiRoutes.js` (API route definitions)
- `src/controllers/authController.js` (register/login logic)
- `src/controllers/scheduleController.js` (schedule and email endpoint logic)
- `src/middleware/auth.js` (JWT auth middleware)
- `src/db/*` (database connection, init/migrations, query helpers)
- `src/utils/schedule.js` (schedule input normalization/validation)

## 1. Backend setup

1. Open terminal in backend folder.
2. Install dependencies:
   npm install
3. Create environment file from example:
   copy .env.example .env
4. Edit .env with your own values:
   - JWT_SECRET: any strong random string
   - GMAIL_USER: your Gmail address
   - GMAIL_APP_PASSWORD: Gmail App Password
5. Start backend:
   npm start

Backend runs on:
- http://localhost:4000

## 2. Frontend setup

Open frontend/index.html in browser, or serve the folder with any static server.

If you want a local static server quickly:
1. Open terminal in frontend folder.
2. Run:
   npx http-server -p 5500
3. Open:
   http://localhost:5500

## 3. API endpoints

- POST /api/register
- POST /api/login
- GET /api/schedule?date=YYYY-MM-DD
- POST /api/schedule
- PUT /api/schedule/:id
- PATCH /api/schedule/:id
- DELETE /api/schedule/:id
- POST /api/schedule/send-day

All schedule endpoints require Bearer token from login response.

## 4. Parameter examples (for requirement proof)

Use these examples to show query, path, and header parameters clearly.

### Query parameter example

GET http://localhost:4000/api/schedule?date=2026-03-30

- query parameter: `date=2026-03-30`

### Path parameter examples

PUT http://localhost:4000/api/schedule/7
PATCH http://localhost:4000/api/schedule/7
DELETE http://localhost:4000/api/schedule/7

- path parameter: `:id` (example value: `7`)

### Header parameter example

For protected endpoints, include header:

Authorization: Bearer <token>

Example request:

curl -X GET "http://localhost:4000/api/schedule?date=2026-03-30" \
   -H "Authorization: Bearer YOUR_JWT_TOKEN"
