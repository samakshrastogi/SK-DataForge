import mongoose from "mongoose";
import { env } from "./env";

export const connectDatabase = async () => {
  await mongoose.connect(env.mongoUri, {
    dbName: env.mongoDbName
  });
};
