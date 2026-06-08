import { env } from "../config/env";
import { UserModel } from "../models/User";
import { hashPassword } from "../utils/auth";

export const ensureBootstrapAdmin = async () => {
  const existingUsers = await UserModel.estimatedDocumentCount();

  if (existingUsers > 0) {
    return;
  }

  const email = env.adminEmail || "admin@sk-dataforge.local";
  const password = env.adminPassword || "ChangeMe123!";

  await UserModel.create({
    name: "Workspace Admin",
    email,
    role: "admin",
    passwordHash: await hashPassword(password),
    active: true
  });

  console.warn(
    `Created bootstrap admin account for ${email}. Set ADMIN_EMAIL and ADMIN_PASSWORD before production use.`
  );
};
