import { Router } from "express";
import { createLoan, defaultLoan, getLoan, getLoans, repayLoan, cancelLoan } from "../controllers/loan.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router: Router = Router();

router.use(authMiddleware); // All loan routes require auth

router.post("/", createLoan);
router.get("/", getLoans);
router.get("/:loanId", getLoan);
router.post("/:loanId/repay", repayLoan);
router.post("/:loanId/default", defaultLoan);
router.post("/:loanId/cancel", cancelLoan);

export default router;