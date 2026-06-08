import dotenv from "dotenv";

dotenv.config();

const envKeys = {
  nodeEnv: "NODE_ENV",
  port: "PORT",
  appName: "APP_NAME",
  appUrl: "APP_URL",
  apiBasePath: "API_BASE_PATH",
  mongoUri: "MONGODB_URI",
  mongoDbName: "MONGODB_DB_NAME",
  corsOrigin: "CORS_ORIGIN",
  uploadRoot: "UPLOAD_ROOT",
  authTokenSecret: "AUTH_TOKEN_SECRET",
  adminEmail: "ADMIN_EMAIL",
  adminPassword: "ADMIN_PASSWORD",
  googleClientId: "GOOGLE_CLIENT_ID"
} as const;

const requiredEnvVars = [
  envKeys.appName,
  envKeys.appUrl,
  envKeys.mongoUri,
  envKeys.mongoDbName,
  envKeys.corsOrigin
] as const;

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const getRequiredEnv = (key: (typeof requiredEnvVars)[number]) => process.env[key] as string;

const normalizeUrl = (value: string) => value.replace(/\/+$/, "");

const normalizeBasePath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "/api";
  return trimmed.startsWith("/") ? trimmed.replace(/\/+$/, "") : `/${trimmed.replace(/\/+$/, "")}`;
};

export const env = {
  nodeEnv: process.env[envKeys.nodeEnv] || "development",
  port: Number(process.env[envKeys.port] || 5000),
  appName: getRequiredEnv(envKeys.appName),
  appUrl: normalizeUrl(getRequiredEnv(envKeys.appUrl)),
  apiBasePath: normalizeBasePath(process.env[envKeys.apiBasePath] || "/api"),
  mongoUri: getRequiredEnv(envKeys.mongoUri),
  mongoDbName: getRequiredEnv(envKeys.mongoDbName),
  corsOrigins: getRequiredEnv(envKeys.corsOrigin)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  uploadRoot: process.env[envKeys.uploadRoot] || "uploads",
  authTokenSecret:
    process.env[envKeys.authTokenSecret] ||
    (process.env[envKeys.nodeEnv] === "production"
      ? ""
      : "dev-only-change-this-sk-dataforge-secret"),
  adminEmail: process.env[envKeys.adminEmail] || "",
  adminPassword: process.env[envKeys.adminPassword] || "",
  googleClientId: process.env[envKeys.googleClientId] || ""
};

if (!env.authTokenSecret) {
  throw new Error("Missing required environment variable: AUTH_TOKEN_SECRET");
}
