import express from "express";
const app = express();
const PORT = 3000;
import professorRoutes from "./routes/professorRoutes.js";

// Middleware to parse JSON data
app.use(express.json());

// Basic GET route
app.get("/", (req, res) => {
  res.send("Hello from BroncoSort Backend!");
});

// Example route for your extension
app.get("/api/health", (req, res) => {
  res.json({ status: "active", serverTime: new Date() });
});

app.use("/api/professor", professorRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
