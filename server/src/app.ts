import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { connectDB } from "./config/db.js";
import { connectRedis } from "./config/redis.js";

import authRouter from "./routes/auth.routes.js";
import directoryRouter from "./routes/directory.rotues.js";
import fileRouter from "./routes/file.routes.js";
import shareLinkRouter from "./routes/share-link/share-link.routes.js";
import publicShareRouter from "./routes/share-link/public-share.routes.js"
import restrictedShareRouter from "./routes/share-link/restricted-routes.js"
import { startUploadMaintenanceWorker } from "./workers/upload-maintenance.worker.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { env } from "./config/env.js";

const app = express();

app.use(
  cors({
    origin: env.CLIENT_URLS,
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser(env.COOKIE_SECRET));

app.get("/api/health", (_req, res) => {
  res.json({
    message: "Server is running",
  });
});

// auth routes
app.use("/api/auth", authRouter);
app.use("/api/directories", directoryRouter);
app.use("/api/files", fileRouter);
app.use("/api/share-links", shareLinkRouter);
app.use("/api/shares/public", publicShareRouter);
app.use("/api/shares/restricted", restrictedShareRouter);

app.use(errorHandler);
const PORT = Number(env.PORT) || 4000;

const startServer = async () => {
  try {
    await connectDB();
    startUploadMaintenanceWorker();
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
