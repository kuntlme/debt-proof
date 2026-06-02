import { Router } from "express";
import { getTransactions } from "../controllers/transaction.controller";
const router: Router = Router();

router.get("/", getTransactions);

export default router;