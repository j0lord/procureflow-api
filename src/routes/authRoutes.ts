import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma";
import { authenticateToken, AuthRequest } from "../middleware/authMiddleware";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        username,
      },
      include: {
        role: true,
      },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user.userId,
        username: user.username,
        roleId: user.roleId,
      },
      JWT_SECRET,
      {
        expiresIn: "2h",
      }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        userId: user.userId,
        username: user.username,
        role: user.role.roleName,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      message: "Login failed",
    });
  }
});

// GET /api/auth/me
// Returns the signed-in user and their permissions so the UI can
// show only the pages and buttons they are allowed to use.
router.get("/me", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        userId: req.user!.userId,
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
      return res.status(401).json({
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
    console.error("GET ME ERROR:", error);

    res.status(500).json({
      message: "Failed to load current user",
    });
  }
});

export default router;