// routes/canvasRoutes.js
import express from "express";
import { setupCanvasFeed } from "../controllers/canvasController.js";

const router = express.Router();

// Maps the endpoint directly to the controller logic
router.post("/setup-feed", setupCanvasFeed);

export default router;
