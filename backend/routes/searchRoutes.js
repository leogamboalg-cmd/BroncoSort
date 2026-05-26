import express from "express";
import { searchSchools } from "../controllers/searchController.js";

const router = express.Router();

// This path is relative to where the router is mounted in server.js
router.post("/search", searchSchools);

export default router;
