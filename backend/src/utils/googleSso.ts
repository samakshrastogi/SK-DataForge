import crypto from "crypto";
import { env } from "../config/env";

type GoogleJwk = {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n: string;
  e: string;
};

type GoogleTokenPayload = {
  iss: string;
  aud: string;
  exp: number;
  email: string;
  email_verified: boolean;
  name?: string;
};

let cachedKeys: { expiresAt: number; keys: GoogleJwk[] } | null = null;

const decodeBase64UrlJson = <T>(value: string) =>
  JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;

const loadGoogleKeys = async () => {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) {
    return cachedKeys.keys;
  }

  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!response.ok) {
    throw new Error("Failed to load Google SSO certificates.");
  }

  const cacheControl = response.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 60 * 60 * 1000;
  const body = (await response.json()) as { keys: GoogleJwk[] };
  cachedKeys = {
    expiresAt: Date.now() + maxAgeMs,
    keys: body.keys || []
  };

  return cachedKeys.keys;
};

export const verifyGoogleCredential = async (credential: string): Promise<GoogleTokenPayload> => {
  if (!env.googleClientId) {
    throw new Error("Google SSO is not configured.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = credential.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Invalid Google credential.");
  }

  const header = decodeBase64UrlJson<{ alg: string; kid: string }>(encodedHeader);
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Unsupported Google credential.");
  }

  const keys = await loadGoogleKeys();
  const key = keys.find((item) => item.kid === header.kid);
  if (!key) {
    throw new Error("Google credential key was not found.");
  }

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  const valid = verifier.verify(
    crypto.createPublicKey({ key, format: "jwk" }),
    Buffer.from(encodedSignature, "base64url")
  );

  if (!valid) {
    throw new Error("Invalid Google credential signature.");
  }

  const payload = decodeBase64UrlJson<GoogleTokenPayload>(encodedPayload);
  const trustedIssuer = payload.iss === "https://accounts.google.com" || payload.iss === "accounts.google.com";

  if (!trustedIssuer || payload.aud !== env.googleClientId || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Google credential is not valid for this workspace.");
  }

  if (!payload.email || !payload.email_verified) {
    throw new Error("Google account email is not verified.");
  }

  return payload;
};
