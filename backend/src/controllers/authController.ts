import { Request, Response } from "express";
import { UserModel } from "../models/User";
import { createAuthToken, hashPassword, UserRole, verifyPassword } from "../utils/auth";

const serializeUser = (user: { _id: unknown; name: string; email: string; role: UserRole }) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role
});

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

    await UserModel.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

    const token = createAuthToken({
      userId: String(user._id),
      email: user.email,
      role: user.role
    });

    return res.status(200).json({
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sign in.";
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
