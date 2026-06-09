//server.js
import express from "express";
import cors from "cors";
import professorRoutes from "./routes/professorRoutes.js";
import collectDataRoutes from "./routes/collectDataRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import storeSchoolRoutes from "./routes/storeSchoolRoutes.js";
import rateLimit from "express-rate-limit";

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

// Middleware
// app.use(cors());

const allowedDomains = [
  // Local
  "localhost",

  // CSU / UC
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

  // Nearby community colleges
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
      // Allows Postman, curl, same-origin requests, etc.
      if (!origin) {
        return callback(null, true);
      }

      // Allows only your Chrome extension
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

// Increase limit to handle bloated university tables
app.use(express.json({ limit: "10mb" }));
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
app.use("/api/collectData", ratingsLimiter, collectDataRoutes);
app.use("/api/schools", ratingsLimiter, searchRoutes);
app.use("/api/collect", ratingsLimiter, storeSchoolRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong internally." });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
