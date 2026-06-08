const envKeys = {
  apiUrl: "VITE_API_URL",
  appName: "VITE_APP_NAME",
  appUrl: "VITE_APP_URL"
} as const;

const requiredClientEnvVars = [envKeys.apiUrl, envKeys.appName, envKeys.appUrl] as const;

for (const key of requiredClientEnvVars) {
  if (!import.meta.env[key]) {
    throw new Error(`Missing required frontend environment variable: ${key}`);
  }
}

const getRequiredClientEnv = (key: (typeof requiredClientEnvVars)[number]) => import.meta.env[key] as string;

const normalizeUrl = (value: string) => value.replace(/\/+$/, "");

export const clientEnv = {
  apiUrl: normalizeUrl(getRequiredClientEnv(envKeys.apiUrl)),
  appName: getRequiredClientEnv(envKeys.appName),
  appUrl: normalizeUrl(getRequiredClientEnv(envKeys.appUrl))
};
