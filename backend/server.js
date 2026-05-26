//server.js
import express from "express";
import cors from "cors";
import professorRoutes from "./routes/professorRoutes.js";
import collectDataRoutes from "./routes/collectDataRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import rateLimit from "express-rate-limit";

const app = express();
const PORT = process.env.PORT || 3000;
app.set("trust proxy", true);

const ratingsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again shortly." },
});

// Middleware
// app.use(cors());
app.use(
  cors({
    origin: [
      "https://cmsweb.cms.cpp.edu",
      "http://localhost:3000",
      "http://localhost:5500",
    ],
  }),
);
// Increase limit to handle bloated university tables
app.use(express.json({ limit: "100kb" }));
// Basic GET route
app.get("/", (req, res) => {
  res.send("Hello from BroncoSort Backend!");
});
app.get("/ip", (req, res) => {
  res.json({
    ip: req.ip,
    ips: req.ips, // List of proxy IPs if trust proxy is on
    header: req.headers["x-forwarded-for"],
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "active", serverTime: new Date() });
});

app.use("/api/professor", ratingsLimiter, professorRoutes);
app.use("/api/collect", ratingsLimiter, collectDataRoutes);
app.use("/api/schools", ratingsLimiter, searchRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
