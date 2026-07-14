import { Router } from "express";
import { createUser, getUser, searchUsers, issueToken } from "../controllers/user.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router: Router = Router();

router.post("/token", issueToken);           // Issue JWT (called from Next.js after OAuth)
router.post("/", createUser);                // Register / init wallet
router.get("/me", authMiddleware, getUser);  // Get own profile
router.get("/search", authMiddleware, searchUsers); // Search users for loan creation

export default router;