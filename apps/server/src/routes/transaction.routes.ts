import { Router } from "express";
import { getTransactions } from "../controllers/transaction.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router: Router = Router();

router.use(authMiddleware);
router.get("/", getTransactions);

export default router;