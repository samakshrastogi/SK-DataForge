import { Request, Response } from "express";

export const getHealth = (_req: Request, res: Response) => {
  res.status(200).json({
    message: "Backend is running",
    timestamp: new Date().toISOString()
  });
};
