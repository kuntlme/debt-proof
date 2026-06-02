import { Router } from "express";
import { createUser, getUser } from "../controllers/user.controller";
const router: Router = Router();

router.post("/", createUser);
router.get("/me", getUser);


export default router;