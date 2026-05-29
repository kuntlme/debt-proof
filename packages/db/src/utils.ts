import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
    adapter: PrismaPg | undefined;
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error(
        "DATABASE_URL is not defined. Set it in your environment or in apps/client/.env."
    );
}

// create adapter once
export const adapter = globalForPrisma.adapter || new PrismaPg({ connectionString: databaseUrl });

// create prismaClient with adapter
export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
    globalForPrisma.adapter = adapter;
}

export default prisma;