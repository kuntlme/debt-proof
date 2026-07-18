import { Router } from "express";
import express from "express";
import { createOrder, verifyAndActivate, handleWebhook, createRepayOrder, verifyAndRepay } from "../controllers/payment.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router: Router = Router();

// Webhook MUST receive raw body for HMAC signature verification
// It does NOT use authMiddleware (called externally by Razorpay)
router.post(
  "/webhook",
  express.raw({ type: "*/*" }),
  handleWebhook
);

// All other payment routes require a logged-in user
router.post("/create-order", authMiddleware, createOrder);
router.post("/verify-and-activate", authMiddleware, verifyAndActivate);
router.post("/create-repay-order", authMiddleware, createRepayOrder);
router.post("/verify-and-repay", authMiddleware, verifyAndRepay);

export default router;
