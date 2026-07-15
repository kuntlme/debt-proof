import prisma from "@repo/db";
import { decryptWallet } from "./blockchain.service";

/**
 * Retrieve and decrypt a user's Ethereum private key from their stored
 * encrypted keystore JSON (written at onboarding).
 *
 * ⚠️  CUSTODIAL — fine for hackathon/prototype.
 *     For production: return unsigned tx payloads and have the user
 *     sign them in the browser (MetaMask / WalletConnect).
 *
 * @param userId  DB user ID
 * @returns       hex private key string (0x-prefixed)
 * @throws        if user has no wallet or decryption fails
 */
export async function getPrivateKeyForUser(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { encryptedSeedPhrase: true },
  });

  if (!user?.encryptedSeedPhrase) {
    throw new Error(
      `User ${userId} has no encrypted wallet. Complete onboarding first.`
    );
  }

  const password =
    process.env.WALLET_ENCRYPTION_SECRET || userId;

  const wallet = await decryptWallet(user.encryptedSeedPhrase, password);
  return wallet.privateKey;
}
