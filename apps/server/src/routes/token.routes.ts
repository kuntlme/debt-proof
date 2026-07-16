import { Router } from "express";
import {
  createToken,
  getPortfolio,
  getToken,
  getTokenHolder,
} from "../controllers/token.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
const router: Router = Router();

router.get("/me", authMiddleware, getToken);
// create token
router.post("/create", authMiddleware, createToken);
router.get("/:tokenId/holder", getTokenHolder);
// show all tokens user currently holds
router.get("/portfolio", authMiddleware, getPortfolio);

export default router;

