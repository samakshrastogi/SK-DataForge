import { NextFunction, Request, Response } from "express";
import { UserModel } from "../models/User";
import { UserRole, verifyAuthToken } from "../utils/auth";

const ROLE_RANK: Record<UserRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3
};

const getTokenFromRequest = (req: Request) => {
  const header = req.header("authorization") || "";
  const bearerMatch = header.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) {
    return bearerMatch[1];
  }

  const queryToken = req.query.token;
  return typeof queryToken === "string" ? queryToken : "";
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyAuthToken(token) : null;

  if (!payload) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const user = await UserModel.findById(payload.userId)
    .select({ email: 1, name: 1, role: 1, active: 1 })
    .lean<{ _id: unknown; email: string; name: string; role: UserRole; active: boolean } | null>();

  if (!user || !user.active) {
    return res.status(401).json({ message: "User account is not active." });
  }

  req.authUser = {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role
  };

  return next();
};

export const requireRole = (minimumRole: UserRole) => (req: Request, res: Response, next: NextFunction) => {
  const role = req.authUser?.role;

  if (!role || ROLE_RANK[role] < ROLE_RANK[minimumRole]) {
    return res.status(403).json({ message: "You do not have permission to perform this action." });
  }

  return next();
};
