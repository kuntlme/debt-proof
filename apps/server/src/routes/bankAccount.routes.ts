import { Router } from "express";
import { saveBankAccount, getMyBankAccount, deleteBankAccount } from "../controllers/bankAccount.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get("/me", getMyBankAccount);
router.post("/", saveBankAccount);
router.delete("/me", deleteBankAccount);

export default router;
