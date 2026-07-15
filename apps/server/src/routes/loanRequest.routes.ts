import { Router } from "express";
import {
  createLoanRequest,
  getNotifications,
  getNotificationCount,
  getLoanRequest,
  getMyLoanRequests,
  acceptLoanRequest,
  declineLoanRequest,
  cancelLoanRequest,
} from "../controllers/loanRequest.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router: Router = Router();

// All loan-request routes require auth
router.use(authMiddleware);

router.get("/notifications", getNotifications);          // GET  /loan-requests/notifications
router.get("/notifications/count", getNotificationCount); // GET  /loan-requests/notifications/count
router.get("/mine", getMyLoanRequests);                  // GET  /loan-requests/mine
router.post("/", createLoanRequest);                     // POST /loan-requests
router.get("/:id", getLoanRequest);                      // GET  /loan-requests/:id
router.post("/:id/accept", acceptLoanRequest);           // POST /loan-requests/:id/accept
router.post("/:id/decline", declineLoanRequest);         // POST /loan-requests/:id/decline
router.delete("/:id", cancelLoanRequest);                // DEL  /loan-requests/:id

export default router;
