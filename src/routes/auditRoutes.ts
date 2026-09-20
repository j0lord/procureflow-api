import { Router } from "express";
import prisma from "../config/prisma";
import { authenticateToken } from "../middleware/authMiddleware";
import { requirePermission } from "../middleware/permissionMiddleware";

const router = Router();

// GET all audit logs
router.get(
  "/",
  authenticateToken,
  requirePermission("VIEW_AUDIT_LOGS"),
  async (req, res) => {
  try {
    const logs = await prisma.auditTrail.findMany({
      include: {
        user: {
          include: {
            role: true,
          },
        },
        request: {
          include: {
            item: true,
            warehouse: true,
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    res.json(logs);
  } catch (error) {
    console.error("GET AUDIT LOGS ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch audit logs",
    });
  }
});

export default router;