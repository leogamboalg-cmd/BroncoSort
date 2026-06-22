//collectDataRoutes.js
import express from "express";
import { getProfessorSummary } from "../controllers/getProfessorSummaryController.js";

const router = express.Router();

// This path is relative to where the router is mounted in server.js
router.post("/getProfessorSummaryy", getProfessorSummary);

export default router;
