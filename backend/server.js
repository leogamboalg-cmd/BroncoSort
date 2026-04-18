import express from "express";
import cors from "cors";
import professorRoutes from "./routes/professorRoutes.js";
import rateLimit from "express-rate-limit";

const app = express();
const PORT = process.env.PORT || 3000;

const ratingsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again shortly." },
});

// Middleware
app.use(cors());
app.use(express.json());

// Basic GET route
app.get("/", (req, res) => {
  res.send("Hello from BroncoSort Backend!");
});

app.get("/api/health", (req, res) => {
  res.json({ status: "active", serverTime: new Date() });
});

app.use("/api/professor", ratingsLimiter, professorRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
