import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing DATABASE_URL in .env");
  return url;
}

const pool = new Pool({ connectionString: getDatabaseUrl() });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clean (optional): smaže jen data, ne tabulky
  await prisma.feederAssignment.deleteMany();
  await prisma.feeder.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.purchaseImportLine.deleteMany();
  await prisma.purchaseImportBatch.deleteMany();
  await prisma.part.deleteMany();

  // Feeders
  const feeders = await prisma.feeder.createMany({
    data: [{ feederNo: "F01" }, { feederNo: "F02" }, { feederNo: "F15" }],
  });

  void feeders;

  // Parts + inventory
  const parts = await Promise.all([
    prisma.part.create({
      data: {
        partNumber: "RES_10K",
        description: "Resistor 10k",
        moq: 100,
        orderMultiple: 100,
        supplier: "Mouser",
        inventory: { create: { onHand: 50, onOrder: 200, reserved: 0 } },
      },
    }),
    prisma.part.create({
      data: {
        partNumber: "CAP_1UF",
        description: "Capacitor 1uF",
        moq: 1,
        orderMultiple: 1,
        supplier: "Mouser",
        inventory: { create: { onHand: 500, onOrder: 0, reserved: 0 } },
      },
    }),
    prisma.part.create({
      data: {
        partNumber: "IC_ATMEGA328P",
        description: "MCU ATmega328P",
        moq: 1,
        orderMultiple: 1,
        supplier: "Mouser",
        inventory: { create: { onHand: 0, onOrder: 50, reserved: 0 } },
      },
    }),
    prisma.part.create({
      data: {
        partNumber: "LED_RED_0603",
        description: "Red LED 0603",
        moq: 20,
        orderMultiple: 20,
        supplier: "Mouser",
        inventory: { create: { onHand: 200, onOrder: 0, reserved: 0 } },
      },
    }),
  ]);

  const byPn = new Map(parts.map((p) => [p.partNumber, p]));

  // Assign feeders (nasazeno)
  const f01 = await prisma.feeder.findUnique({ where: { feederNo: "F01" } });
  const f02 = await prisma.feeder.findUnique({ where: { feederNo: "F02" } });

  if (!f01 || !f02) throw new Error("Missing feeders after creation");

  await prisma.feederAssignment.createMany({
    data: [
      {
        partId: byPn.get("RES_10K")!.id,
        feederId: f01.id,
        active: true,
      },
      {
        partId: byPn.get("CAP_1UF")!.id,
        feederId: f02.id,
        active: true,
      },
    ],
  });

  console.log("Seed done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });