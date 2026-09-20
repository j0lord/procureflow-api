import express from "express";
import "dotenv/config";
import cors from "cors";

import restockingRoutes from "./routes/restockingRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import auditRoutes from "./routes/auditRoutes";
import roleRoutes from "./routes/roleRoutes";
import permissionRoutes from "./routes/permissionRoutes";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import itemRoutes from "./routes/itemRoutes";

const app = express();

// Allowed frontend origins. Set FRONTEND_URL in production, e.g.
// FRONTEND_URL=https://procureflow.vercel.app
// Several origins can be separated with commas.
const allowedOrigins = (
  process.env.FRONTEND_URL ?? "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "ProcureFlow API is running",
  });
});

app.use("/api/restocking-requests", restockingRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/items", itemRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`ProcureFlow API running on http://localhost:${PORT}`);
});