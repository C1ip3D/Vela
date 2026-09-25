import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ownershipGuardExtension } from "./ownershipGuard";

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  // Every consumer of `prisma` gets the ownership guard automatically —
  // it's applied here, not left as something each caller must opt into.
  return new PrismaClient({ adapter, log: ["error"] }).$extends(ownershipGuardExtension);
}

type ExtendedPrismaClient = ReturnType<typeof createClient>;
const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
export * from "./ownershipGuard";
export default prisma;
