import dotenv from "dotenv";

dotenv.config();

const requiredEnvVars = ["MONGODB_URI", "CORS_ORIGIN", "APP_URL"] as const;

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI as string,
  corsOrigins: (process.env.CORS_ORIGIN as string)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  uploadRoot: process.env.UPLOAD_ROOT || "uploads",
  mongoDbName: process.env.MONGODB_DB_NAME || "sk-dataforge",
  appUrl: process.env.APP_URL as string
};
