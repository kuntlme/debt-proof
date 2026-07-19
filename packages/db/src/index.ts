import prisma from "./utils.js";
// next auth prisma adapter
import { PrismaAdapter } from "@auth/prisma-adapter";


// re-export auth adapter pre-bound to prisma instance
export { PrismaAdapter };

export default prisma;
// Export types for sharing
export * from "../generated/prisma/client.js";

export const __esModule = true;