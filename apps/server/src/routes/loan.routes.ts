import { Router } from "express";
import { createLoan, defaultLoan, getLoan, getLoans, repayLoan } from "../controllers/loan.controller";
const router: Router = Router();

router.post("/", createLoan);
router.get("/", getLoans);
router.get("/:loanId", getLoan);
router.post("/:loanId/replay", repayLoan);
router.post("/:loanId/default", defaultLoan);



export default router;