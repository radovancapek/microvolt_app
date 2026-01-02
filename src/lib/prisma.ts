import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing DATABASE_URL in environment (.env).");
  }
  return url;
}

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    const pool =
      globalForPrisma.pgPool ??
      new Pool({
        connectionString: getDatabaseUrl(),
      });

    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.pgPool = pool;
    }

    const adapter = new PrismaPg(pool);

    return new PrismaClient({
      adapter,
      log: ["error", "warn"],
    });
  })();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}