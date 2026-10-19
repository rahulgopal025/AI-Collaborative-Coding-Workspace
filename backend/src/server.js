require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const logger = require("./common/utils/logger");
const {
  connectDatabase,
  disconnectDatabase,
} = require("./config/database");

const { setupCollaborationGateway } = require("./modules/collaboration/collaboration.gateway");
const { setupProjectRunnerGateway } = require("./modules/projectRunner/projectRunner.gateway");
const codeServerService = require("./modules/projectRunner/codeServer.service");

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Mount the code-server reverse proxy (handles HTTP + WebSocket for workspace access)
app.mountCodeServerProxy(server);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const collabGateway = setupCollaborationGateway(io);
const runnerGateway = setupProjectRunnerGateway(io);

async function startServer() {
  try {
    await connectDatabase();

    server.listen(PORT, "0.0.0.0", () => {
      logger.info(
        { port: PORT },
        `CodeCollabAI backend running on port ${PORT}`
      );
    });
  } catch (error) {
    logger.error(
      { error: error.message },
      "Failed to start CodeCollabAI backend"
    );

    process.exit(1);
  }
}

async function gracefulShutdown(signal) {
  logger.info({ signal }, "Shutdown signal received");

  // Close collaboration gateway to persist documents
  if (collabGateway) {
    await collabGateway.close();
  }

  // Destroy all project runner containers (direct Docker exec)
  if (runnerGateway) {
    await runnerGateway.close();
  }

  // Destroy all code-server containers
  await codeServerService.destroyAll();

  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

startServer();

