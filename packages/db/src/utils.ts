import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
    pool: pg.Pool | undefined;
    adapter: PrismaPg | undefined;
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error(
        "DATABASE_URL is not defined. Set it in your environment or in apps/client/.env."
    );
}

// Use a Pool (not a raw connectionString) so that concurrent Prisma queries
// each get their own pg client — eliminates the pg@9 DeprecationWarning:
// "Calling client.query() when the client is already executing a query"
export const pool =
    globalForPrisma.pool ||
    new pg.Pool({ connectionString: databaseUrl });

export const adapter =
    globalForPrisma.adapter || new PrismaPg(pool);

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pool = pool;
    globalForPrisma.prisma = prisma;
    globalForPrisma.adapter = adapter;
}

export default prisma;