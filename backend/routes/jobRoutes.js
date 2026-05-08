const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const idempotencyKey = require("../middleware/idempotencyKey");
const { createActionCooldownMiddleware } = require("../middleware/actionCooldown");
const { bookingIpLimiter, bookingUserLimiter } = require("../middleware/rateLimiters");
const jobController = require("../controllers/jobController");
const {
  validateCreateJob,
  validateRejectJob,
  validateJobIdParam,
  validateStatusQuery
} = require("../validations/jobValidation");

const BOOKING_COOLDOWN_MS = Number.parseInt(process.env.COOLDOWN_BOOKING_MS, 10) || 8000;
const bookingCooldown = createActionCooldownMiddleware({
  cooldownMs: BOOKING_COOLDOWN_MS,
  actionType: "booking",
  message: "Please wait before creating another booking request."
});

router.get("/time-slots", jobController.listTimeSlots);
router.post(
  "/",
  auth,
  role("customer"),
  bookingIpLimiter,
  bookingUserLimiter,
  bookingCooldown,
  idempotencyKey,
  validateCreateJob,
  jobController.createJobRequest
);
router.post(
  "/create",
  auth,
  role("customer"),
  bookingIpLimiter,
  bookingUserLimiter,
  bookingCooldown,
  idempotencyKey,
  validateCreateJob,
  jobController.createJobRequest
);
router.get("/my-requests", auth, role("customer"), validateStatusQuery, jobController.listCustomerRequests);
router.get("/my-inbox", auth, role("worker"), validateStatusQuery, jobController.listWorkerInbox);
router.patch("/:id/accept", auth, role("worker"), validateJobIdParam, jobController.acceptRequest);
router.patch("/accept/:id", auth, role("worker"), validateJobIdParam, jobController.acceptRequest);
router.patch("/:id/reject", auth, role("worker"), validateJobIdParam, validateRejectJob, jobController.rejectRequest);
router.patch("/:id/complete", auth, validateJobIdParam, jobController.completeRequest);
router.patch("/complete/:id", auth, validateJobIdParam, jobController.completeRequest);
router.patch("/:id/cancel", auth, role("customer"), validateJobIdParam, jobController.cancelRequest);

module.exports = router;
