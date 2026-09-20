
import { Router, Response } from "express";
import prisma from "../config/prisma";
import { authenticateToken, AuthRequest } from "../middleware/authMiddleware";
import { requirePermission } from "../middleware/permissionMiddleware";

const router = Router();

/*
  GET ALL ITEMS
  GET /api/items
*/
router.get(
  "/",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const items = await prisma.item.findMany({
        orderBy: {
          sku: "asc",
        },
      });

      return res.status(200).json(items);
    } catch (error) {
      console.error("GET ITEMS ERROR:", error);

      return res.status(500).json({
        message: "Failed to retrieve items",
      });
    }
  }
);

/*
  GET ONE ITEM
  GET /api/items/:sku
*/
router.get(
  "/:sku",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const sku = Array.isArray(req.params.sku)
        ? req.params.sku[0]
        : req.params.sku;

      const item = await prisma.item.findUnique({
        where: {
          sku,
        },
      });

      if (!item) {
        return res.status(404).json({
          message: "Item not found",
        });
      }

      return res.status(200).json(item);
    } catch (error) {
      console.error("GET ITEM ERROR:", error);

      return res.status(500).json({
        message: "Failed to retrieve item",
      });
    }
  }
);

/*
  CREATE ITEM
  POST /api/items
*/
router.post(
  "/",
  authenticateToken,
  requirePermission("MANAGE_ITEMS"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { sku, itemName } = req.body;

      if (!sku || !itemName) {
        return res.status(400).json({
          message: "SKU and item name are required",
        });
      }

      const existingItem = await prisma.item.findUnique({
        where: {
          sku,
        },
      });

      if (existingItem) {
        return res.status(409).json({
          message: "Item already exists",
        });
      }

      const item = await prisma.item.create({
        data: {
          sku,
          itemName,
        },
      });

      return res.status(201).json(item);
    } catch (error) {
      console.error("CREATE ITEM ERROR:", error);

      return res.status(500).json({
        message: "Failed to create item",
      });
    }
  }
);

/*
  UPDATE ITEM
  PATCH /api/items/:sku
*/
router.patch(
  "/:sku",
  authenticateToken,
  requirePermission("MANAGE_ITEMS"),
  async (req: AuthRequest, res: Response) => {
    try {
      const sku = Array.isArray(req.params.sku)
        ? req.params.sku[0]
        : req.params.sku;

      const { itemName } = req.body;

      if (!itemName) {
        return res.status(400).json({
          message: "Item name is required",
        });
      }

      const existingItem = await prisma.item.findUnique({
        where: {
          sku,
        },
      });

      if (!existingItem) {
        return res.status(404).json({
          message: "Item not found",
        });
      }

      const updatedItem = await prisma.item.update({
        where: {
          sku,
        },
        data: {
          itemName,
        },
      });

      return res.status(200).json(updatedItem);
    } catch (error) {
      console.error("UPDATE ITEM ERROR:", error);

      return res.status(500).json({
        message: "Failed to update item",
      });
    }
  }
);

/*
  DELETE ITEM
  DELETE /api/items/:sku
*/
router.delete(
  "/:sku",
  authenticateToken,
  requirePermission("MANAGE_ITEMS"),
  async (req: AuthRequest, res: Response) => {
    try {
      const sku = Array.isArray(req.params.sku)
        ? req.params.sku[0]
        : req.params.sku;

      const existingItem = await prisma.item.findUnique({
        where: {
          sku,
        },
      });

      if (!existingItem) {
        return res.status(404).json({
          message: "Item not found",
        });
      }

      const inventory = await prisma.inventory.findFirst({
        where: {
          sku,
        },
      });

      if (inventory) {
        return res.status(409).json({
          message:
            "Cannot delete item because it is currently used in inventory",
        });
      }

      const request = await prisma.restockingRequest.findFirst({
        where: {
          sku,
        },
      });

      if (request) {
        return res.status(409).json({
          message:
            "Cannot delete item because it is used by a restocking request",
        });
      }

      const deletedItem = await prisma.item.delete({
        where: {
          sku,
        },
      });

      return res.status(200).json({
        message: "Item deleted successfully",
        item: deletedItem,
      });
    } catch (error) {
      console.error("DELETE ITEM ERROR:", error);

      return res.status(500).json({
        message: "Failed to delete item",
      });
    }
  }
);

export default router;

