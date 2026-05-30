import { Router } from "express";
import { applyToken, getAllTokenList, mintRequest, setWallet } from "../controllers/web3Controller";

const router:Router = Router();


router.post('/wallet', setWallet);
router.post('/apply-token', applyToken);
router.post('/mint-request', mintRequest);
router.get('/token-list', getAllTokenList);

export default router;