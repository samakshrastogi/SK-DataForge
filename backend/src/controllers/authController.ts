import { Request, Response } from "express";
import crypto from "crypto";
import { PasswordResetTokenModel } from "../models/PasswordResetToken";
import { UserModel } from "../models/User";
import { createAuthToken, hashPassword, UserRole, verifyPassword } from "../utils/auth";
import { verifyGoogleCredential } from "../utils/googleSso";

const serializeUser = (user: { _id: unknown; name: string; email: string; role: UserRole }) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role
});

const issueSession = async (user: { _id: unknown; name: string; email: string; role: UserRole }) => {
  await UserModel.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
  return {
    token: createAuthToken({
      userId: String(user._id),
      email: user.email,
      role: user.role
    }),
    user: serializeUser(user)
  };
};

const hashResetToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const login = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await UserModel.findOne({ email }).lean<{
      _id: unknown;
      name: string;
      email: string;
      passwordHash: string;
      role: UserRole;
      active: boolean;
    } | null>();

    if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    return res.status(200).json(await issueSession(user));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sign in.";
    return res.status(400).json({ message });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || password.length < 8) {
      return res.status(400).json({ message: "Name, email, and an 8+ character password are required." });
    }

    const user = await UserModel.create({
      name,
      email,
      role: "viewer",
      passwordHash: await hashPassword(password),
      active: true
    });

    return res.status(201).json(await issueSession(user));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to register.";
    return res.status(400).json({ message });
  }
};

export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const user = email
      ? await UserModel.findOne({ email, active: true }).select({ _id: 1, email: 1 }).lean<{ _id: unknown; email: string } | null>()
      : null;

    let resetToken = "";

    if (user) {
      resetToken = crypto.randomBytes(32).toString("base64url");
      await PasswordResetTokenModel.create({
        userId: user._id,
        tokenHash: hashResetToken(resetToken),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      });
    }

    return res.status(200).json({
      message: "If that account exists, a reset link has been prepared.",
      resetToken: process.env.NODE_ENV === "production" ? undefined : resetToken || undefined
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to request password reset.";
    return res.status(400).json({ message });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const token = String(req.body.token || "").trim();
    const password = String(req.body.password || "");

    if (!token || password.length < 8) {
      return res.status(400).json({ message: "Reset token and an 8+ character password are required." });
    }

    const resetRecord = await PasswordResetTokenModel.findOne({
      tokenHash: hashResetToken(token),
      usedAt: null,
      expiresAt: { $gt: new Date() }
    }).lean<{ _id: unknown; userId: unknown } | null>();

    if (!resetRecord) {
      return res.status(400).json({ message: "Reset token is invalid or expired." });
    }

    await UserModel.findByIdAndUpdate(resetRecord.userId, {
      passwordHash: await hashPassword(password),
      active: true
    });
    await PasswordResetTokenModel.findByIdAndUpdate(resetRecord._id, { usedAt: new Date() });

    return res.status(200).json({ message: "Password updated." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reset password.";
    return res.status(400).json({ message });
  }
};

export const googleSignIn = async (req: Request, res: Response) => {
  try {
    const credential = String(req.body.credential || "").trim();
    const payload = await verifyGoogleCredential(credential);
    const user = await UserModel.findOneAndUpdate(
      { email: payload.email.toLowerCase() },
      {
        $setOnInsert: {
          name: payload.name || payload.email.split("@")[0],
          email: payload.email.toLowerCase(),
          role: "viewer",
          passwordHash: await hashPassword(crypto.randomBytes(32).toString("base64url"))
        },
        $set: {
          active: true
        }
      },
      { new: true, upsert: true }
    );

    return res.status(200).json(await issueSession(user));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sign in with Google.";
    return res.status(400).json({ message });
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  if (!req.authUser) {
    return res.status(401).json({ message: "Authentication required." });
  }

  return res.status(200).json({ user: req.authUser });
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = String(req.body.role || "viewer").trim() as UserRole;

    if (!name || !email || password.length < 8) {
      return res.status(400).json({ message: "Name, email, and an 8+ character password are required." });
    }

    if (!["admin", "editor", "viewer"].includes(role)) {
      return res.status(400).json({ message: "Invalid role." });
    }

    const user = await UserModel.create({
      name,
      email,
      role,
      passwordHash: await hashPassword(password),
      active: true
    });

    return res.status(201).json({ user: serializeUser(user) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user.";
    return res.status(400).json({ message });
  }
};

export const listUsers = async (_req: Request, res: Response) => {
  try {
    const users = await UserModel.find({}, { name: 1, email: 1, role: 1, active: 1, lastLoginAt: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      users: users.map((user) => ({
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load users.";
    return res.status(400).json({ message });
  }
};
