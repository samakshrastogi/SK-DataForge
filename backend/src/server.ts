import app from "./app";
import { startAutomationScheduler } from "./controllers/automationController";
import { connectDatabase } from "./config/db";
import { env } from "./config/env";

const startServer = async () => {
  try {
    await connectDatabase();
    startAutomationScheduler();
    app.listen(env.port, () => {
      console.log(`Backend listening on ${env.appUrl}`);
    });
  } catch (error) {
    console.error("Failed to start backend", error);
    process.exit(1);
  }
};

void startServer();
