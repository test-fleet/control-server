const path = require("path");
const express = require("express");
const fs = require("fs");
const os = require("os");
const mongoose = require("mongoose");
const cookieParser = require('cookie-parser')
const passport = require('passport')

const { setupPassport } = require('./src/utils/oauthPassport')
const { setupSwagger } = require('./src/utils/swaggerConfig')
const { bootstrapAdminAccount } = require("./src/utils/bootstrapAdmin");
const { bootstrapDevRunner } = require('./src/utils/bootstrapRunner')
const { bootstrapSampleScene } = require('./src/utils/bootstrapSampleScene')
const { connectDatabase, disconnectDatabase } = require("./config/db");
const { connectRedis, disconnectRedis, getPublisher } = require("./config/redis");
const scheduler = require("./src/utils/scheduler");
const errorHandler = require("./src/middleware/errors");

const { authenticateJWT } = require('./src/middleware/auth')
const authRoutes = require('./src/routes/auth.routes')
const userRoutes = require('./src/routes/user.routes')
const runnerRoutes = require('./src/routes/runner.routes')
const sceneRoutes = require('./src/routes/scene.routes')
const frameRoutes = require('./src/routes/frame.routes')
const resultsRoutes = require('./src/routes/results.routes')
const brandingRoutes = require('./src/routes/branding.routes')
const dashboardRoutes = require('./src/routes/dashboard.routes')

async function startServer() {
  try {
    await setupPassport();
    await connectDatabase();
    await connectRedis();
    await bootstrapAdminAccount();

    if (process.env.ENV.toLowerCase() == "dev") {
      await bootstrapDevRunner()
      await bootstrapSampleScene()
    }

    await scheduler.reload()

    const app = express();
    app.use(express.json({
      verify: (req, _res, buf) => { req.rawBody = buf.toString('utf-8') }
    }));
    app.use(cookieParser());
    app.use(passport.initialize());

    setupSwagger(app);

    app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'ok' });
    });

    app.get('/ready', (_req, res) => {
      const mongoOk = mongoose.connection.readyState === 1;
      let redisOk = false;
      try {
        redisOk = getPublisher().isOpen;
      } catch {
        redisOk = false;
      }
      const ok = mongoOk && redisOk;
      res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'unavailable', mongo: mongoOk, redis: redisOk });
    });

    app.get('/api/v1/metrics', authenticateJWT, (_req, res) => {
      const mem = process.memoryUsage();
      const load = os.loadavg();
      res.json({
        uptime: Math.floor(process.uptime()),
        memory: {
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
          rss: mem.rss,
        },
        system: {
          loadAvg1: parseFloat(load[0].toFixed(2)),
          totalMem: os.totalmem(),
          freeMem: os.freemem(),
        },
        node: process.version,
        platform: process.platform,
      });
    });

    app.get('/api/v1/config', (_req, res) => {
      res.json({
        heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 30000,
      });
    });

    app.use('/api/v1', authRoutes);
    app.use('/api/v1', userRoutes);
    app.use('/api/v1', runnerRoutes);
    app.use('/api/v1', sceneRoutes);
    app.use('/api/v1', frameRoutes);
    app.use('/api/v1', resultsRoutes);
    app.use('/api/v1', brandingRoutes);
    app.use('/api/v1', dashboardRoutes);

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
  await disconnectRedis();
  process.exit(0);
});

startServer();

