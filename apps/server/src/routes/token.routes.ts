import { Router } from "express";
import { getPortfolio, getToken, getTokenHolder } from "../controllers/token.controller";
const router: Router = Router();

router.get("/me", getToken);
router.get("/:tokenId/holder", getTokenHolder);
// show all tokes user currently holds
router.get("/portfolio", getPortfolio);

export default router;