const requiredClientEnvVars = ["VITE_API_URL", "VITE_APP_NAME"] as const;

for (const key of requiredClientEnvVars) {
  if (!import.meta.env[key]) {
    throw new Error(`Missing required frontend environment variable: ${key}`);
  }
}

export const clientEnv = {
  apiUrl: import.meta.env.VITE_API_URL as string,
  appName: import.meta.env.VITE_APP_NAME as string
};
