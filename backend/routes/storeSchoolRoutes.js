import express from "express";
import { storeSchools } from "../controllers/storeSchoolsController.js";

const router = express.Router();

// This path is relative to where the router is mounted in server.js
router.post("/store", storeSchools);

export default router;
