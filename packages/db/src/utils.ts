import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
    pool: pg.Pool | undefined;
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error(
        "DATABASE_URL is not defined. Set it in your environment or in apps/client/.env."
    );
}

// Use a Pool with adequate size so that each concurrent Prisma query gets its
// own pg client — this eliminates the pg@9 DeprecationWarning:
// "Calling client.query() when the client is already executing a query"
//
// The warning fires when @prisma/adapter-pg reuses a single checked-out pg.Client
// for multiple sequential statements within the same async context (e.g. a
// transaction). A pool with max >= 10 ensures a fresh client is always available.
export const pool =
    globalForPrisma.pool ??
    new pg.Pool({
        connectionString: databaseUrl,
        max: 10,                    // max simultaneous connections
        idleTimeoutMillis: 30_000,  // close idle clients after 30 s
        connectionTimeoutMillis: 5_000, // fail fast if pool is exhausted
    });

// Fresh adapter per process — do NOT cache the adapter in globalThis because
// PrismaPg holds a reference to its internal connection state.
const adapter = new PrismaPg(pool);

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pool = pool;
    globalForPrisma.prisma = prisma;
}

export default prisma;