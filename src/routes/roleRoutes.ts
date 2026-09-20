import { Router } from "express";
import prisma from "../config/prisma";
import { authenticateToken } from "../middleware/authMiddleware";
import { requirePermission } from "../middleware/permissionMiddleware";

const router = Router();

// GET all roles
// Admin only
router.get(
  "/",
  authenticateToken,
  requirePermission("MANAGE_ROLES"),
  async (req, res) => {
    try {
      const roles = await prisma.role.findMany({
        orderBy: {
          roleId: "asc",
        },
      });

      res.json(roles);
    } catch (error) {
      console.error("GET ROLES ERROR:", error);

      res.status(500).json({
        message: "Failed to fetch roles",
      });
    }
  }
);

// POST a new role
// Admin only
router.post(
  "/",
  authenticateToken,
  requirePermission("MANAGE_ROLES"),
  async (req, res) => {
    try {
      const { roleName } = req.body;

      if (!roleName || typeof roleName !== "string") {
        return res.status(400).json({
          message: "roleName is required",
        });
      }

      const role = await prisma.role.create({
        data: {
          roleName: roleName.trim(),
        },
      });

      res.status(201).json(role);
    } catch (error) {
      console.error("CREATE ROLE ERROR:", error);

      res.status(500).json({
        message: "Failed to create role",
      });
    }
  }
);

export default router;