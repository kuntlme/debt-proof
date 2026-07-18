import { Router } from "express";
import {
  checkUsername,
  completeOnboarding,
  createUser,
  getUser,
  getPublicProfile,
  searchUsers,
  issueToken,
  getCreditScore,
} from "../controllers/user.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router: Router = Router();

router.get("/check-username", checkUsername);                      // GET  /users/check-username?username=xxx  (public)
router.post("/token", issueToken);                                  // POST /users/token  (called from Next.js)
router.post("/onboarding", completeOnboarding);                    // POST /users/onboarding  (public — no wallet yet)
router.post("/", createUser);                                       // POST /users  (legacy wallet init)
router.get("/me", authMiddleware, getUser);                        // GET  /users/me
router.get("/me/credit-score", authMiddleware, getCreditScore);   // GET  /users/me/credit-score
router.get("/search", authMiddleware, searchUsers);                // GET  /users/search?q=...
router.get("/:userId/profile", authMiddleware, getPublicProfile); // GET  /users/:userId/profile

export default router;