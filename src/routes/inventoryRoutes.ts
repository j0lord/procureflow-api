import { Router } from "express";
import prisma from "../config/prisma";
import { authenticateToken } from "../middleware/authMiddleware";
import { requirePermission } from "../middleware/permissionMiddleware";

const router = Router();

// GET all inventory
router.get(
  "/",
  authenticateToken,
  requirePermission("VIEW_INVENTORY"),
  async (req, res) => {
  try {
    const inventory = await prisma.inventory.findMany({
      include: {
        item: true,
        warehouse: true,
      },
      orderBy: {
        sku: "asc",
      },
    });

    const result = inventory.map((record) => {
      let status = "IN_STOCK";

      if (record.availableStock === 0) {
        status = "OUT_OF_STOCK";
      } else if (record.availableStock <= 10) {
        status = "LOW_STOCK";
      }

      return {
        sku: record.sku,
        itemName: record.item.itemName,
        warehouseId: record.warehouseId,
        warehouseName: record.warehouse.warehouseName,
        availableStock: record.availableStock,
        status,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("GET INVENTORY ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch inventory",
    });
  }
});

export default router;