import prisma from "../src/config/prisma";

async function main() {
  // 1. Create Role
  const role = await prisma.role.upsert({
    where: {
      roleId: 1,
    },
    update: {
      roleName: "Warehouse Staff",
    },
    create: {
      roleId: 1,
      roleName: "Warehouse Staff",
    },
  });

  // 2. Create User
  const user = await prisma.user.upsert({
    where: {
      userId: 1,
    },
    update: {
      username: "warehouse_staff",
      roleId: role.roleId,
    },
    create: {
      userId: 1,
      username: "warehouse_staff",
      roleId: role.roleId,
    },
  });

  // 3. Create Item
  const item = await prisma.item.upsert({
    where: {
      sku: "ITEM-001",
    },
    update: {
      itemName: "Test Item",
    },
    create: {
      sku: "ITEM-001",
      itemName: "Test Item",
    },
  });

  // 4. Create Warehouse
  const warehouse = await prisma.warehouse.upsert({
    where: {
      warehouseId: "WH-001",
    },
    update: {
      warehouseName: "Main Warehouse",
    },
    create: {
      warehouseId: "WH-001",
      warehouseName: "Main Warehouse",
    },
  });

  // 5. Create Inventory
  await prisma.inventory.upsert({
    where: {
      sku_warehouseId: {
        sku: item.sku,
        warehouseId: warehouse.warehouseId,
      },
    },
    update: {
      availableStock: 100,
    },
    create: {
      sku: item.sku,
      warehouseId: warehouse.warehouseId,
      availableStock: 100,
    },
  });

  console.log("Seed data created successfully!");
  console.log("Role:", role);
  console.log("User:", user);
  console.log("Item:", item);
  console.log("Warehouse:", warehouse);
  console.log("Inventory: 100");
}

main()
  .catch((error) => {
    console.error("SEED ERROR:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });