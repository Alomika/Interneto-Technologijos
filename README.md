# Interneto Technologijos

Project structure:
- frontend: vanilla HTML/CSS/JS app for register, login, timetable CRUD, logout, and send-day email action
- backend: Node.js + Express + SQLite API

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
- DELETE /api/schedule/:id
- POST /api/schedule/send-day

All schedule endpoints require Bearer token from login response.
