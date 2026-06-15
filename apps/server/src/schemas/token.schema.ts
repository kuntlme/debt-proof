import { z } from "zod";

export const createTokenSchema = z.object({
  tokenName: z.string().min(3).max(50),

  symbol: z.string().min(2).max(10).toUpperCase(),
});

export type CreateTokenInput = z.infer<typeof createTokenSchema>;
