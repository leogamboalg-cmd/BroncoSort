//collectDataRoutes.js
import express from "express";
import { collectData } from "../controllers/collectDataController.js";

const router = express.Router();

// This path is relative to where the router is mounted in server.js
router.post("/collectData", collectData);

export default router;
