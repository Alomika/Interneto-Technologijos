const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { register, login } = require("../controllers/authController");
const {
  getSchedule,
  createScheduleItem,
  updateScheduleItem,
  patchScheduleItem,
  deleteScheduleItem,
  sendDaySchedule,
  sendTestEmail
} = require("../controllers/scheduleController");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.post("/register", register);
router.post("/login", login);

router.get("/schedule", authMiddleware, getSchedule);
router.post("/schedule", authMiddleware, createScheduleItem);
router.put("/schedule/:id", authMiddleware, updateScheduleItem);
router.patch("/schedule/:id", authMiddleware, patchScheduleItem);
router.delete("/schedule/:id", authMiddleware, deleteScheduleItem);

router.post("/schedule/send-day", authMiddleware, sendDaySchedule);
router.post("/email-test", authMiddleware, sendTestEmail);

module.exports = router;
