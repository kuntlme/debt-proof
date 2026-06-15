import { Router } from "express";
import {
  createToken,
  getPortfolio,
  getToken,
  getTokenHolder,
} from "../controllers/token.controller";
import { authMiddleware } from "../middleware/auth.middleware";
const router: Router = Router();

router.get("/me", getToken);
// create token
router.post("/create", authMiddleware, createToken);
router.get("/:tokenId/holder", getTokenHolder);
// show all tokes user currently holds
router.get("/portfolio", getPortfolio);

export default router;

