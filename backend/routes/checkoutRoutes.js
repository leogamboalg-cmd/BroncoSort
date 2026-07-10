import express from "express";
import {
  createCheckoutSession,
  verifyCheckoutSession,
} from "../controllers/checkoutController.js";

const router = express.Router();

router.post("/create-checkout-session", createCheckoutSession);
router.get("/verify/:sessionId", verifyCheckoutSession);

export default router;
