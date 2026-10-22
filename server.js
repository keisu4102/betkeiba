require("dotenv").config();
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const api = require("./src/routes");

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api", api);

app.get("/health", (_req, res) => res.json({ ok: true, app: "ToteTrack" }));

const PORT = process.env.PORT || 3000;
async function start() {
  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI. Copy .env.example to .env and add your MongoDB connection string.");
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");
    app.listen(PORT, () => console.log(`ToteTrack running at http://localhost:${PORT}`));
  } catch (err) {
    console.error("Could not connect to MongoDB:", err.message);
    process.exit(1);
  }
}
start();
