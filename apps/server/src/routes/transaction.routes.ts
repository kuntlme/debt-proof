import { Router } from "express";
import { getTransactions } from "../controllers/transaction.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router: Router = Router();

router.use(authMiddleware);
router.get("/", getTransactions);

export default router;