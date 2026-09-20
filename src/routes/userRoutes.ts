import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma";
import {
  authenticateToken,
  AuthRequest,
} from "../middleware/authMiddleware";
import { requirePermission } from "../middleware/permissionMiddleware";

const router = Router();

// GET all users
// Admin only
router.get(
  "/",
  authenticateToken,
  requirePermission("MANAGE_USERS"),
  async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          userId: true,
          username: true,
          roleId: true,
          role: {
            select: {
              roleName: true,
            },
          },
        },
        orderBy: {
          userId: "asc",
        },
      });

      res.json(users);
    } catch (error) {
      console.error("GET USERS ERROR:", error);

      res.status(500).json({
        message: "Failed to fetch users",
      });
    }
  }
);

// POST a new user
// Admin only
router.post(
  "/",
  authenticateToken,
  requirePermission("MANAGE_USERS"),
  async (req, res) => {
    try {
      const { username, password, roleId } = req.body;

      if (!username || !password || roleId === undefined) {
        return res.status(400).json({
          message: "username, password, and roleId are required",
        });
      }

      if (typeof username !== "string" || typeof password !== "string") {
        return res.status(400).json({
          message: "username and password must be strings",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          message: "Password must be at least 6 characters",
        });
      }

      const numericRoleId = Number(roleId);

      if (!Number.isInteger(numericRoleId)) {
        return res.status(400).json({
          message: "Invalid roleId",
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: {
          username: username.trim(),
        },
      });

      if (existingUser) {
        return res.status(409).json({
          message: "Username already exists",
        });
      }

      const role = await prisma.role.findUnique({
        where: {
          roleId: numericRoleId,
        },
      });

      if (!role) {
        return res.status(404).json({
          message: "Role not found",
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          username: username.trim(),
          passwordHash,
          roleId: numericRoleId,
        },
        select: {
          userId: true,
          username: true,
          roleId: true,
        },
      });

      res.status(201).json({
        message: "User created successfully",
        user,
      });
    } catch (error) {
      console.error("CREATE USER ERROR:", error);

      res.status(500).json({
        message: "Failed to create user",
      });
    }
  }
);

// PATCH a user
// Admin only
router.patch(
  "/:userId",
  authenticateToken,
  requirePermission("MANAGE_USERS"),
  async (req, res) => {
    try {
      const userId = Number(req.params.userId);

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          message: "Invalid userId",
        });
      }

      const { username, password, roleId } = req.body;

      if (
        username === undefined &&
        password === undefined &&
        roleId === undefined
      ) {
        return res.status(400).json({
          message: "At least one field is required",
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: {
          userId,
        },
      });

      if (!existingUser) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      const data: {
        username?: string;
        passwordHash?: string;
        roleId?: number;
      } = {};

      if (username !== undefined) {
        if (typeof username !== "string" || !username.trim()) {
          return res.status(400).json({
            message: "username must be a non-empty string",
          });
        }

        const newUsername = username.trim();

        const usernameExists = await prisma.user.findFirst({
          where: {
            username: newUsername,
            NOT: {
              userId,
            },
          },
        });

        if (usernameExists) {
          return res.status(409).json({
            message: "Username already exists",
          });
        }

        data.username = newUsername;
      }

      if (password !== undefined) {
        if (typeof password !== "string" || password.length < 6) {
          return res.status(400).json({
            message: "Password must be at least 6 characters",
          });
        }

        data.passwordHash = await bcrypt.hash(password, 10);
      }

      if (roleId !== undefined) {
        const numericRoleId = Number(roleId);

        if (!Number.isInteger(numericRoleId)) {
          return res.status(400).json({
            message: "Invalid roleId",
          });
        }

        const role = await prisma.role.findUnique({
          where: {
            roleId: numericRoleId,
          },
        });

        if (!role) {
          return res.status(404).json({
            message: "Role not found",
          });
        }

        data.roleId = numericRoleId;
      }

      const updatedUser = await prisma.user.update({
        where: {
          userId,
        },
        data,
        select: {
          userId: true,
          username: true,
          roleId: true,
          role: {
            select: {
              roleName: true,
            },
          },
        },
      });

      res.json({
        message: "User updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("UPDATE USER ERROR:", error);

      res.status(500).json({
        message: "Failed to update user",
      });
    }
  }
);

// DELETE a user
// Admin only
router.delete(
  "/:userId",
  authenticateToken,
  requirePermission("MANAGE_USERS"),
  async (req: AuthRequest, res) => {
    try {
      const userId = Number(req.params.userId);

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          message: "Invalid userId",
        });
      }

      if (req.user?.userId === userId) {
        return res.status(400).json({
          message: "You cannot delete your own account",
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

      await prisma.user.delete({
        where: {
          userId,
        },
      });

      res.json({
        message: "User deleted successfully",
      });
    } catch (error) {
      console.error("DELETE USER ERROR:", error);

      res.status(500).json({
        message: "Failed to delete user",
      });
    }
  }
);

export default router;