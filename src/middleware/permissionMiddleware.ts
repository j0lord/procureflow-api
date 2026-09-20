import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "./authMiddleware";

export function requirePermission(permissionName: string) {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          message: "Authentication required",
        });
      }

      const permission = await prisma.userPermission.findFirst({
        where: {
          userId: req.user.userId,
          permission: {
            permissionName,
          },
        },
      });

      if (!permission) {
        return res.status(403).json({
          message: `Permission denied: ${permissionName}`,
        });
      }

      next();
    } catch (error) {
      console.error("PERMISSION CHECK ERROR:", error);

      return res.status(500).json({
        message: "Failed to verify permission",
      });
    }
  };
}