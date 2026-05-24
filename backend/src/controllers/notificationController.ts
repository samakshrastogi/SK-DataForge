import { Request, Response } from "express";
import { NotificationModel } from "../models/Notification";

export const getNotifications = async (_req: Request, res: Response) => {
  try {
    const [items, unreadCount] = await Promise.all([
      NotificationModel.find({}).sort({ createdAt: -1 }).limit(20).lean(),
      NotificationModel.countDocuments({ read: false })
    ]);

    return res.status(200).json({
      unreadCount,
      items: items.map((item) => ({
        id: String(item._id),
        type: item.type,
        title: item.title,
        message: item.message,
        read: item.read,
        metadata: item.metadata || {},
        createdAt: item.createdAt
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load notifications.";
    return res.status(400).json({ message });
  }
};

export const markAllNotificationsRead = async (_req: Request, res: Response) => {
  try {
    await NotificationModel.updateMany({ read: false }, { read: true });
    return res.status(200).json({ message: "Notifications marked as read." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update notifications.";
    return res.status(400).json({ message });
  }
};
