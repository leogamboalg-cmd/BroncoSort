import express from "express";
import { findSchoolAndProfessors } from "../controllers/professorController.js";

const router = express.Router();

// This path is relative to where the router is mounted in server.js
router.post("/ratings", findSchoolAndProfessors);

export default router;
