import { Router } from "express";
import prisma from "../config/prisma";
import { authenticateToken } from "../middleware/authMiddleware";
import { requirePermission } from "../middleware/permissionMiddleware";

const router = Router();

// GET dashboard summary
router.get(
  "/",
  authenticateToken,
  requirePermission("VIEW_REQUESTS"),
  async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const pendingRequests = await prisma.restockingRequest.count({
      where: {
        status: "PENDING",
      },
    });

    const approvedToday = await prisma.restockingRequest.count({
      where: {
        status: "APPROVED",
        decisionAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });

    const inventory = await prisma.inventory.findMany();

    const lowStockAlerts = inventory.filter(
      (item) => item.availableStock > 0 && item.availableStock <= 10
    ).length;

    const totalInventory = inventory.reduce(
      (total, item) => total + item.availableStock,
      0
    );

    res.json({
      pendingRequests,
      approvedToday,
      lowStockAlerts,
      totalInventory,
    });
  } catch (error) {
    console.error("DASHBOARD ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch dashboard summary",
    });
  }
});

export default router;