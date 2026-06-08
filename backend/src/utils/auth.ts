import crypto from "crypto";
import { env } from "../config/env";

export type UserRole = "admin" | "editor" | "viewer";

export type AuthTokenPayload = {
  userId: string;
  email: string;
  role: UserRole;
  exp: number;
};

const TOKEN_TTL_SECONDS = 60 * 60 * 12;
const PASSWORD_ITERATIONS = 120_000;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_DIGEST = "sha512";

const base64UrlEncode = (value: Buffer | string) =>
  Buffer.from(value).toString("base64url");

const sign = (value: string) =>
  crypto.createHmac("sha256", env.authTokenSecret).update(value).digest("base64url");

export const hashPassword = async (password: string) => {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      PASSWORD_ITERATIONS,
      PASSWORD_KEY_LENGTH,
      PASSWORD_DIGEST,
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      }
    );
  });

  return `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${hash.toString("base64url")}`;
};

export const verifyPassword = async (password: string, storedHash: string) => {
  const [scheme, iterationsValue, salt, hashValue] = storedHash.split("$");

  if (scheme !== "pbkdf2" || !iterationsValue || !salt || !hashValue) {
    return false;
  }

  const iterations = Number(iterationsValue);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    return false;
  }

  const expected = Buffer.from(hashValue, "base64url");
  const actual = await new Promise<Buffer>((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, expected.length, PASSWORD_DIGEST, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

export const createAuthToken = (payload: Omit<AuthTokenPayload, "exp">) => {
  const tokenPayload: AuthTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
};

export const verifyAuthToken = (token: string): AuthTokenPayload | null => {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || sign(encodedPayload) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AuthTokenPayload;
    if (!payload.userId || !payload.email || !payload.role || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};
