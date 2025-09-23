const path = require("path");
const express = require("express");
const fs = require("fs");
const passport = require('passport')

const { setupPassport } = require('./src/utils/oauthPassport')
const { setupSwagger } = require('./src/utils/swaggerConfig')
const { bootstrapAdminAccount } = require("./src/utils/bootstrapAdmin");
const { connectDatabase, disconnectDatabase } = require("./config/db");
const errorHandler = require("./src/middleware/errors");

const authRoutes = require('./src/routes/auth.routes')

async function startServer() {
  try {
    await setupPassport();
    await connectDatabase();
    await bootstrapAdminAccount();

    const app = express();
    app.use(express.json());
    app.use(passport.initialize());

    setupSwagger(app);

    app.use('/api/v1', authRoutes);

    const FRONTEND_DIST = path.resolve(process.cwd(), "frontend", "dist");
    app.use(express.static(FRONTEND_DIST));

    // Anything NOT starting with /api goes to React app
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(FRONTEND_DIST, "index.html"));
    });

    app.use(errorHandler)

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`server running on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  console.log("shutting down gracefully...");
  await disconnectDatabase();
  process.exit(0);
});

startServer();

