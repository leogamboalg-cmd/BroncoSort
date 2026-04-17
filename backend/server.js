import express from "express";
import cors from "cors";
import professorRoutes from "./routes/professorRoutes.js";

const app = express();
const PORT = process.env.PORT || 3000;

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

app.use("/api/professor", professorRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
