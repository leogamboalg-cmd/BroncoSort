// server.js
import dotenv from "dotenv";
// 1. MUST load environment variables at the absolute top of the file
dotenv.config();

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

// Import your custom routes
import professorRoutes from "./routes/professorRoutes.js";
import collectDataRoutes from "./routes/collectDataRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import storeSchoolRoutes from "./routes/storeSchoolRoutes.js";
import getProfessorSumamaryRoutes from "./routes/getProfessorSummaryRoutes.js";
import checkoutRoutes from "./routes/checkoutRoutes.js";
import canvasRoutes from "./routes/canvasRoutes.js";
import { handleStripeWebhook } from "./controllers/stripeWebhookController.js";

// 2. Import your database connection script (replaces require("./config/db"))
import "./config/db.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

const ratingsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again shortly." },
});

// Allowed domains arrays remain exactly the same
const allowedDomains = [
  "localhost",
  "127.0.0.1",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "cmsweb.cms.cpp.edu",
  "cpp.edu",
  "fullerton.edu",
  "calstate.edu",
  "csulb.edu",
  "csudh.edu",
  "csueastbay.edu",
  "csufresno.edu",
  "humboldt.edu",
  "csula.edu",
  "csum.edu",
  "csumb.edu",
  "csun.edu",
  "csus.edu",
  "csusb.edu",
  "sdsu.edu",
  "sfsu.edu",
  "sjsu.edu",
  "sonoma.edu",
  "calpoly.edu",
  "berkeley.edu",
  "ucdavis.edu",
  "uci.edu",
  "ucla.edu",
  "ucr.edu",
  "ucmerced.edu",
  "ucsb.edu",
  "ucsc.edu",
  "ucsd.edu",
  "ucsf.edu",
  "mtsac.edu",
  "citruscollege.edu",
  "riohondo.edu",
  "chaffey.edu",
  "pasadena.edu",
  "glendale.edu",
  "elac.edu",
  "cerritos.edu",
  "fullcoll.edu",
  "cypresscollege.edu",
  "sac.edu",
  "sccollege.edu",
  "ivc.edu",
  "saddleback.edu",
  "orangecoastcollege.edu",
  "lbcc.edu",
];

const allowedExtensionOrigins = [
  "chrome-extension://iimoegnkdjicpamkelchhfcibglblmnh",
  "chrome-extension://fncmdjkackjaicadhgnmlgeckladjkoi",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedExtensionOrigins.includes(origin)) {
        return callback(null, true);
      }
      try {
        const { hostname } = new URL(origin);
        const allowed = allowedDomains.some((domain) => {
          return hostname === domain || hostname.endsWith(`.${domain}`);
        });
        if (allowed) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      } catch {
        return callback(new Error(`Invalid CORS origin: ${origin}`));
      }
    },
  }),
);

app.post(
  "/api/stripe/webhook",
  express.raw({
    type: "application/json",
  }),
  handleStripeWebhook,
);

app.use(express.json({ limit: "10mb" }));

// Basic utility routes
app.get("/", (req, res) => {
  res.send("Hello from BroncoSort Backend!");
});

app.get("/ip", (req, res) => {
  res.json({
    ip: req.ip,
    ips: req.ips,
    header: req.headers["x-forwarded-for"],
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "active", serverTime: new Date() });
});

// App Router Declarations
app.use("/api/professor", ratingsLimiter, professorRoutes);
app.use("/api/collectData", ratingsLimiter, collectDataRoutes);
app.use("/api/schools", ratingsLimiter, searchRoutes);
app.use("/api/collect", ratingsLimiter, storeSchoolRoutes);
app.use("/api/summary", ratingsLimiter, getProfessorSumamaryRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/canvas", canvasRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong internally." });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
