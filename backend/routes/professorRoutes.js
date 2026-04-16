import express from "express";
import { findSchoolAndProfessor } from "../controllers/professorController.js";

const router = express.Router();

// This path is relative to where the router is mounted in server.js
router.get("/search", findSchoolAndProfessor);

export default router;
