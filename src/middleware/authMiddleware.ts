import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    username: string;
    roleId: number;
  };
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Bearer token is required",
    });
  }

  const token = authHeader.substring(7);

  if (!token) {
    return res.status(401).json({
      message: "Invalid authorization format",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthRequest["user"];

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}