import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { connectDB } from "./config/db.js";
import { connectRedis } from "./config/redis.js";

import authRoutes from "./routes/auth.routes.js";
import directoryRoutes from "./routes/directory.rotues.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const COOKIE_SECRET = process.env.COOKIE_SECRET;
const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URLS,
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser(COOKIE_SECRET));

app.get("/api/health", (_req, res) => {
  res.json({
    message: "Server is running",
  });
});

// auth routes
app.use("/api/auth", authRoutes);
app.use("/api/directory", directoryRoutes);

app.use(errorHandler);
const PORT = Number(process.env.PORT) || 4000;

const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
