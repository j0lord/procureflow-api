import { Router } from "express";
import prisma from "../config/prisma";
import { authenticateToken } from "../middleware/authMiddleware";
import { requirePermission } from "../middleware/permissionMiddleware";

const router = Router();

// GET all permissions
// Admin only
router.get(
  "/",
  authenticateToken,
  requirePermission("MANAGE_PERMISSIONS"),
  async (req, res) => {
    try {
      const permissions = await prisma.permission.findMany({
        orderBy: {
          permissionId: "asc",
        },
      });

      res.json(permissions);
    } catch (error) {
      console.error("GET PERMISSIONS ERROR:", error);

      res.status(500).json({
        message: "Failed to fetch permissions",
      });
    }
  }
);

// GET permissions for a specific user
// Admin only
router.get(
  "/user/:userId",
  authenticateToken,
  requirePermission("MANAGE_PERMISSIONS"),
  async (req, res) => {
    try {
      const userId = Number(req.params.userId);

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          message: "Invalid userId",
        });
      }

      const user = await prisma.user.findUnique({
        where: {
          userId,
        },
        include: {
          role: true,
          userPermissions: {
            include: {
              permission: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      res.json({
        userId: user.userId,
        username: user.username,
        role: user.role.roleName,
        permissions: user.userPermissions.map(
          (userPermission) => userPermission.permission.permissionName
        ),
      });
    } catch (error) {
      console.error("GET USER PERMISSIONS ERROR:", error);

      res.status(500).json({
        message: "Failed to fetch user permissions",
      });
    }
  }
);

// POST assign a permission to a user
// Admin only
router.post(
  "/user/:userId",
  authenticateToken,
  requirePermission("MANAGE_PERMISSIONS"),
  async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const permissionId = Number(req.body.permissionId);

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          message: "Invalid userId",
        });
      }

      if (!Number.isInteger(permissionId)) {
        return res.status(400).json({
          message: "Invalid permissionId",
        });
      }

      const user = await prisma.user.findUnique({
        where: {
          userId,
        },
      });

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      const permission = await prisma.permission.findUnique({
        where: {
          permissionId,
        },
      });

      if (!permission) {
        return res.status(404).json({
          message: "Permission not found",
        });
      }

      const existingAssignment = await prisma.userPermission.findFirst({
        where: {
          userId,
          permissionId,
        },
      });

      if (existingAssignment) {
        return res.status(409).json({
          message: "Permission is already assigned to this user",
        });
      }

      const assignment = await prisma.userPermission.create({
        data: {
          userId,
          permissionId,
        },
      });

      res.status(201).json({
        message: "Permission assigned successfully",
        assignment,
      });
    } catch (error) {
      console.error("ASSIGN PERMISSION ERROR:", error);

      res.status(500).json({
        message: "Failed to assign permission",
      });
    }
  }
);

// DELETE a permission from a user
// Admin only
router.delete(
  "/user/:userId/:permissionId",
  authenticateToken,
  requirePermission("MANAGE_PERMISSIONS"),
  async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const permissionId = Number(req.params.permissionId);

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          message: "Invalid userId",
        });
      }

      if (!Number.isInteger(permissionId)) {
        return res.status(400).json({
          message: "Invalid permissionId",
        });
      }

      const assignment = await prisma.userPermission.findFirst({
        where: {
          userId,
          permissionId,
        },
      });

      if (!assignment) {
        return res.status(404).json({
          message: "Permission assignment not found",
        });
      }

      await prisma.userPermission.delete({
        where: {
          userId_permissionId: {
            userId,
            permissionId,
          },
        },
      });

      res.json({
        message: "Permission removed successfully",
      });
    } catch (error) {
      console.error("REMOVE PERMISSION ERROR:", error);

      res.status(500).json({
        message: "Failed to remove permission",
      });
    }
  }
);

export default router;