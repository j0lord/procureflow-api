import { Router } from "express";
import prisma from "../config/prisma";
import { authenticateToken, AuthRequest } from "../middleware/authMiddleware";
import { requirePermission } from "../middleware/permissionMiddleware";
import { randomUUID } from "crypto";


const router = Router();

// GET all restocking requests
router.get(
  "/",
  authenticateToken,
  requirePermission("VIEW_REQUESTS"),
  async (req: AuthRequest, res) => {
  try {
    const requests = await prisma.restockingRequest.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(requests);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch restocking requests",
    });
  }
});

// POST a new restocking request
router.post(
  "/",
  authenticateToken,
  requirePermission("CREATE_REQUEST"),
  async (req: AuthRequest, res) => {
  try {
    const {
      requestId,
      sku,
      warehouseId,
      quantity,
      priority,
      justification,
      
    } = req.body;

    // Basic validation
if (
  !requestId ||
  !sku ||
  !warehouseId ||
  !priority ||
  !justification
) {
  return res.status(400).json({
    message: "All required fields must be provided",
  });
}

if (quantity === undefined || quantity === null || quantity === "") {
  return res.status(400).json({
    message: "Quantity is required",
  });
}

if (Number(quantity) <= 0) {
  return res.status(400).json({
    message: "Quantity must be greater than 0",
  });
}

    // Create request
    const item = await prisma.item.findUnique({
  where: { sku },
});

if (!item) {
  return res.status(400).json({
    message: "Item not found",
  });
}

const warehouse = await prisma.warehouse.findUnique({
  where: { warehouseId },
});

if (!warehouse) {
  return res.status(400).json({
    message: "Warehouse not found",
  });
}
    const newRequest = await prisma.restockingRequest.create({
      data: {
        requestId,
        sku,
        warehouseId,
        quantity: Number(quantity),
        priority,
        justification,
        status: "PENDING",
        requestedBy: req.user!.userId,
        createdAt: new Date(),
      },
    });

    res.status(201).json(newRequest);
  } catch (error) {
    console.error("CREATE REQUEST ERROR:", error);

    res.status(500).json({
  message: "Failed to create restocking request",
  error: error instanceof Error ? error.message : String(error),
    });
  }
});

// RESUBMIT a returned restocking request
router.patch(
  "/:requestId/resubmit",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { requestId } = req.params;

      const {
        sku,
        warehouseId,
        quantity,
        priority,
        justification,
      } = req.body;

      // Validate required fields
      if (
        !sku ||
        !warehouseId ||
        !quantity ||
        !priority ||
        !justification
      ) {
        return res.status(400).json({
          message: "All required fields must be provided",
        });
      }

      // Validate quantity
      if (Number(quantity) <= 0) {
        return res.status(400).json({
          message: "Quantity must be greater than 0",
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        // Find the request
        const request = await tx.restockingRequest.findUnique({
          where: {
            requestId: String(requestId),
          },
        });

        // Request does not exist
        if (!request) {
          throw new Error("REQUEST_NOT_FOUND");
        }

        // Only the original requester can resubmit
        if (request.requestedBy !== req.user?.userId) {
          throw new Error("NOT_REQUEST_OWNER");
        }

        // Request must be returned for correction
        if (request.status !== "RETURNED_FOR_CORRECTION") {
          throw new Error("REQUEST_NOT_RETURNED");
        }

        // Update request
        const updatedRequest = await tx.restockingRequest.update({
          where: {
            requestId: String(requestId),
          },
          data: {
            sku,
            warehouseId,
            quantity: Number(quantity),
            priority,
            justification,
            status: "PENDING",
            decidedBy: null,
            decisionAt: null,
            correctionNote: null,
            rejectionReason: null,
          },
        });

        // Create audit trail
        await tx.auditTrail.create({
          data: {
            auditId: `AUDIT-${randomUUID()}`,
            requestId: request.requestId,
            action: "RESUBMIT_REQUEST",
            previousStatus: request.status,
            newStatus: "PENDING",
            performedBy: req.user!.userId,
            timestamp: new Date(),
          },
        });

        return updatedRequest;
      });

      // Success response
      res.json({
        message: "Restocking request resubmitted successfully",
        request: result,
      });
    } catch (error) {
      console.error("RESUBMIT REQUEST ERROR:", error);

      if (error instanceof Error) {
        // Request not found
        if (error.message === "REQUEST_NOT_FOUND") {
          return res.status(404).json({
            message: "Restocking request not found",
          });
        }

        // User is not the original requester
        if (error.message === "NOT_REQUEST_OWNER") {
          return res.status(403).json({
            message: "You can only resubmit your own request",
          });
        }

        // Request is not returned for correction
        if (error.message === "REQUEST_NOT_RETURNED") {
          return res.status(400).json({
            message:
              "Only requests returned for correction can be resubmitted",
          });
        }
      }

      res.status(500).json({
        message: "Failed to resubmit restocking request",
      });
    }
  }
);


// REJECT a restocking request
router.patch(
  "/:requestId/reject",
  authenticateToken,
  requirePermission("REJECT_REQUEST"),
  async (req: AuthRequest, res) => {
  try {
    const { requestId } = req.params;
    const { rejectionReason } = req.body;

  

    if (!rejectionReason) {
      return res.status(400).json({
        message: "rejectionReason is required",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.restockingRequest.findUnique({
        where: {
          requestId: String(requestId),
        },
      });

      if (!request) {
        throw new Error("REQUEST_NOT_FOUND");
      }

      if (request.status !== "PENDING") {
        throw new Error("REQUEST_NOT_PENDING");
      }

      const updatedRequest = await tx.restockingRequest.update({
        where: {
          requestId: String(requestId),
        },
        data: {
          status: "REJECTED",
          decidedBy: req.user!.userId,
          decisionAt: new Date(),
          rejectionReason,
        },
      });

      await tx.auditTrail.create({
        data: {
          auditId: `AUDIT-${randomUUID()}`,
          requestId: request.requestId,
          action: "REJECT_REQUEST",
          previousStatus: request.status,
          newStatus: "REJECTED",
          performedBy: req.user!.userId,
          timestamp: new Date(),
        },
      });

      return updatedRequest;
    });

    res.json({
      message: "Restocking request rejected successfully",
      request: result,
    });
  } catch (error) {
    console.error("REJECT REQUEST ERROR:", error);

    if (error instanceof Error) {
      if (error.message === "REQUEST_NOT_FOUND") {
        return res.status(404).json({
          message: "Restocking request not found",
        });
      }

      if (error.message === "REQUEST_NOT_PENDING") {
        return res.status(400).json({
          message: "Only PENDING requests can be rejected",
        });
      }
    }

    res.status(500).json({
      message: "Failed to reject restocking request",
    });
  }
});

// APPROVE a restocking request
router.patch(
  "/:requestId/approve",
  authenticateToken,
  requirePermission("APPROVE_REQUEST"),
  async (req: AuthRequest, res) => {
  try {
    const { requestId } = req.params;


    const result = await prisma.$transaction(async (tx) => {
      // Find the request
      const request = await tx.restockingRequest.findUnique({
        where: {
          requestId: String(requestId),
        },
      });

      if (!request) {
        throw new Error("REQUEST_NOT_FOUND");
      }

      // Request must be pending
      if (request.status !== "PENDING") {
        throw new Error("REQUEST_NOT_PENDING");
      }

      // Check inventory
      const inventory = await tx.inventory.findUnique({
        where: {
          sku_warehouseId: {
            sku: request.sku,
            warehouseId: request.warehouseId,
          },
        },
      });

      if (!inventory) {
        throw new Error("INVENTORY_NOT_FOUND");
      }

// Atomically deduct inventory only if enough stock is still available
const updatedInventory = await tx.inventory.updateMany({
  where: {
    sku: request.sku,
    warehouseId: request.warehouseId,
    availableStock: {
      gte: request.quantity,
    },
  },
  data: {
    availableStock: {
      decrement: request.quantity,
    },
  },
});

if (updatedInventory.count !== 1) {
  throw new Error("INSUFFICIENT_STOCK");
}

      // Create allocation
      const allocation = await tx.allocation.create({
        data: {
          allocationId: `ALLOC-${randomUUID()}`,
          requestId: request.requestId,
          sku: request.sku,
          quantityAllocated: request.quantity,
          status: "ALLOCATED",
          timestamp: new Date(),
        },
      });

      // Update request
      const updatedRequest = await tx.restockingRequest.update({
        where: {
          requestId: String(requestId),
        },
        data: {
          status: "APPROVED",
          decidedBy: req.user!.userId,
          decisionAt: new Date(),
        },
      });

      // Create audit trail
      await tx.auditTrail.create({
        data: {
          auditId: `AUDIT-${randomUUID()}`,
          requestId: request.requestId,
          action: "APPROVE_REQUEST",
          previousStatus: request.status,
          newStatus: "APPROVED",
          performedBy: req.user!.userId,
          timestamp: new Date(),
        },
      });

      return {
        request: updatedRequest,
        allocation,
      };
    });

    res.json({
      message: "Restocking request approved successfully",
      ...result,
    });
  } catch (error) {
    console.error("APPROVE REQUEST ERROR:", error);

    if (error instanceof Error) {
      if (error.message === "REQUEST_NOT_FOUND") {
        return res.status(404).json({
          message: "Restocking request not found",
        });
      }

      if (error.message === "REQUEST_NOT_PENDING") {
        return res.status(400).json({
          message: "Only PENDING requests can be approved",
        });
      }

      if (error.message === "INVENTORY_NOT_FOUND") {
        return res.status(404).json({
          message: "Inventory record not found",
        });
      }

      if (error.message === "INSUFFICIENT_STOCK") {
        return res.status(409).json({
          message: "Insufficient inventory stock",
        });
      }
    }

    res.status(500).json({
      message: "Failed to approve restocking request",
    });
  }
});
router.patch(
  "/:requestId/return",
  authenticateToken,
  requirePermission("RETURN_REQUEST"),
  async (req: AuthRequest, res) => {
    try {
      const { requestId } = req.params;
      const { correctionNote } = req.body;

      if (!correctionNote) {
        return res.status(400).json({
          message: "correctionNote is required",
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const request = await tx.restockingRequest.findUnique({
          where: { requestId: String(requestId) },
        });

        if (!request) {
          throw new Error("REQUEST_NOT_FOUND");
        }

        if (request.status !== "PENDING") {
          throw new Error("REQUEST_NOT_PENDING");
        }

        const updatedRequest = await tx.restockingRequest.update({
          where: { requestId: String(requestId) },
          data: {
            status: "RETURNED_FOR_CORRECTION",
            decidedBy: req.user!.userId,
            decisionAt: new Date(),
            correctionNote,
          },
        });

        await tx.auditTrail.create({
          data: {
            auditId: `AUDIT-${randomUUID()}`,
            requestId: request.requestId,
            action: "RETURN_REQUEST",
            previousStatus: request.status,
            newStatus: "RETURNED_FOR_CORRECTION",
            performedBy: req.user!.userId,
            timestamp: new Date(),
          },
        });

        return updatedRequest;
      });

      res.json({
        message: "Restocking request returned for correction",
        request: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "REQUEST_NOT_FOUND") {
          return res.status(404).json({
            message: "Restocking request not found",
          });
        }

        if (error.message === "REQUEST_NOT_PENDING") {
          return res.status(400).json({
            message: "Only PENDING requests can be returned",
          });
        }
      }

      console.error("RETURN REQUEST ERROR:", error);

      return res.status(500).json({
        message: "Failed to return restocking request",
      });
    }
  }
);
export default router;